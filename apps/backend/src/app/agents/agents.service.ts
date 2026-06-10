import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { ChatHistoryItem, Dino, StreamEvent, ToolCallRecord } from '@org/shared-types';
import { tools } from './tools';
import { getDino } from './dinos';
import { MemoryService, SkillView } from '../memory/memory.service';

const MAX_TOOL_ITERATIONS = 5;
const LLM_TIMEOUT_MS = 20_000;
// Image generation legitimately takes longer than a text turn; give it more room.
const IMAGE_GEN_TIMEOUT_MS = 45_000;

// OpenRouter free models are intermittently rate-limited upstream (429) or slow.
// When a dino's primary (usually `:free`) model errors with a capability/rate
// problem or exceeds the timeout, we transparently retry the same turn once on a
// cheap, reliable paid model so the user still gets an answer. Pennies per call.
const FALLBACK_MODEL = 'openai/gpt-4o-mini';

// Cheap model used only for best-effort durable-fact extraction after a turn.
const MEMORY_EXTRACTION_MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free';
const MAX_FACTS_PER_TURN = 3;

// Minimal structural shape both a bare ChatOpenAI and a tool-bound Runnable
// satisfy — lets buildLlm return either without leaking LangChain's deep generics.
type InvokableLlm = {
  invoke(
    input: BaseMessage[],
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
};

/**
 * Resolve which tool names are active for a request, applying two independent
 * narrowing filters. A dino (if present) restricts to its allowed set; a
 * client-supplied `enabledTools` narrows further. Neither can ever widen the
 * set beyond `allToolNames`.
 *
 * - no dino + enabledTools undefined → all tools (current default behavior)
 * - enabledTools === [] → no tools (the user unchecked everything)
 */
export function resolveActiveTools(
  allToolNames: string[],
  dinoToolNames: string[] | undefined,
  enabledTools: string[] | undefined,
): string[] {
  let names = [...allToolNames];
  if (dinoToolNames !== undefined) {
    names = names.filter((n) => dinoToolNames.includes(n));
  }
  if (enabledTools !== undefined) {
    names = names.filter((n) => enabledTools.includes(n));
  }
  return names;
}

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(private readonly memoryService: MemoryService) {}

  private isCapabilityError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    return (
      msg.includes('402') ||
      msg.includes('404') ||
      msg.includes('429') ||
      msg.includes('rate limit') ||
      msg.includes('not found') ||
      msg.includes('no endpoints') ||
      msg.includes('quota') ||
      msg.includes('context length') ||
      msg.includes('model not found')
    );
  }

  /** Build a (tool-bound, when tools are active) chat model for a given slug. */
  private buildLlm(model: string, activeTools: (typeof tools)[number][]): InvokableLlm {
    const base = new ChatOpenAI({
      model,
      apiKey: process.env['OPENROUTER_API_KEY'],
      configuration: { baseURL: 'https://openrouter.ai/api/v1' },
    });
    return activeTools.length > 0 ? base.bindTools(activeTools) : base;
  }

  /** Invoke the model, rejecting with LLM_TIMEOUT if it exceeds the hard cap. */
  private async invokeWithTimeout(
    llm: InvokableLlm,
    conversation: BaseMessage[],
    signal: AbortSignal,
  ): Promise<AIMessage> {
    let timer: ReturnType<typeof setTimeout>;
    try {
      return (await Promise.race([
        llm.invoke(conversation, { signal }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('LLM_TIMEOUT')), LLM_TIMEOUT_MS);
        }),
      ])) as AIMessage;
    } finally {
      clearTimeout(timer!);
    }
  }

  /** A failure worth retrying on the paid fallback model: rate/capability or timeout. */
  private shouldFallback(error: unknown): boolean {
    return (
      (error instanceof Error && error.message === 'LLM_TIMEOUT') ||
      this.isCapabilityError(error)
    );
  }

  // Manual agent loop — no LangGraph. Mentor specifically called out dropping
  // LangGraph; this gives us full control over tool dispatch and streaming.
  async *streamAgent(
    message: string,
    threadId = 'default',
    model = 'openai/gpt-oss-120b:free',
    signal: AbortSignal,
    enabledTools?: string[],
    dinoId?: string,
    userId?: string,
    history?: ChatHistoryItem[],
    imageDataUrl?: string,
  ): AsyncGenerator<StreamEvent, void, void> {
    // When a dinoId is present the dino owns the model, system prompt, and the
    // ceiling on which tools may be called — all resolved server-side. When it
    // is absent we preserve the exact prior behavior (no system message, model
    // from arg, enabledTools as the only filter).
    const dino = dinoId ? getDino(dinoId) : undefined;
    const effectiveModel = dino?.model ?? model;
    this.logger.log(
      `Streaming agent for thread ${threadId} with model ${effectiveModel}` +
        (dino ? ` (dino: ${dino.id})` : ''),
    );

    // Artist dinos generate an image instead of running the text agent loop —
    // a different response shape (no tools, no token stream) on a dedicated path.
    if (dino?.imageGen) {
      yield* this.streamImageGeneration(message, effectiveModel, signal, imageDataUrl, threadId);
      return;
    }

    // Caller may restrict the toolset. The dino's toolNames are a hard ceiling;
    // a client-supplied enabledTools can only narrow further (undefined = no
    // client filter; [] = the user unchecked every tool in the popover).
    const activeToolNames = resolveActiveTools(
      tools.map((t) => t.name),
      dino?.toolNames,
      enabledTools,
    );
    const activeTools = tools.filter((t) => activeToolNames.includes(t.name));

    try {
      // Primary model is the dino's (often a `:free` model). If it errors with a
      // rate/capability problem or times out, we rebuild on FALLBACK_MODEL and
      // stay there for the rest of the turn (`usedFallback` guards a second swap).
      let currentLlm = this.buildLlm(effectiveModel, activeTools);
      let usedFallback = false;

      // Cross-thread memory + taught skills: pull what this dino has learned about
      // this user and fold it into the system prompt. Scoped per (userId × dinoId).
      let memories: string[] = [];
      let skills: SkillView[] = [];
      if (dino) {
        [memories, skills] = await Promise.all([
          this.memoryService.getMemories(userId, dino.id),
          this.memoryService.getSkills(userId, dino.id),
        ]);
      }
      const systemPrompt = dino ? this.buildSystemPrompt(dino.systemPrompt, skills, memories) : undefined;

      // Within-thread context: replay recent prior turns so follow-ups have
      // context. Four cases per ChatHistoryItem:
      //   user + imageDataUrl → multimodal HumanMessage (same shape as currentTurn)
      //   user (text only)   → HumanMessage(text)
      //   assistant          → AIMessage(text)
      //   tool               → AIMessage(tool_calls) + ToolMessage(toolResult)
      //     The AIMessage+ToolMessage pair reconstructs a faithful replay so the
      //     model sees what it already "fetched" and avoids redundant re-calls.
      const historyMessages: BaseMessage[] = (history ?? []).flatMap(
        (h: ChatHistoryItem, index: number): BaseMessage[] => {
          if (h.role === 'tool') {
            // Reconstruct the prior tool call as the two-message pair the live
            // loop would have produced: AIMessage(tool_calls) + ToolMessage.
            const toolId = `replay-${h.toolName ?? 'unknown'}-${index}`;
            const args: Record<string, unknown> = h.toolArgs ?? {};
            return [
              new AIMessage({
                content: '',
                tool_calls: [{ id: toolId, name: h.toolName ?? '', args }],
              }),
              new ToolMessage({ content: h.toolResult ?? '', tool_call_id: toolId }),
            ];
          }
          if (h.role === 'user') {
            if (h.imageDataUrl) {
              // Multimodal HumanMessage — mirrors the currentTurn builder below.
              return [
                new HumanMessage({
                  content: [
                    ...(h.text ? [{ type: 'text' as const, text: h.text }] : []),
                    { type: 'image_url' as const, image_url: { url: h.imageDataUrl } },
                  ],
                }),
              ];
            }
            return [new HumanMessage(h.text)];
          }
          // assistant
          return [new AIMessage(h.text)];
        },
      );

      // When an image is attached, send a multimodal HumanMessage (text + image)
      // so vision models can reason about it (VIS-02) and OCR it (VIS-03). Plain
      // text turns keep the simple string form. A non-vision dino's model errors
      // on image input and triggers the fallback to a vision-capable model.
      const currentTurn: BaseMessage = imageDataUrl
        ? new HumanMessage({
            content: [
              ...(message ? [{ type: 'text', text: message }] : []),
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          })
        : new HumanMessage(message);

      const conversation: BaseMessage[] = [
        ...(systemPrompt ? [new SystemMessage(systemPrompt)] : []),
        ...historyMessages,
        currentTurn,
      ];
      const toolCallRecords: ToolCallRecord[] = [];

      for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
        if (signal.aborted) return;

        let response: AIMessage;
        try {
          response = await this.invokeWithTimeout(currentLlm, conversation, signal);
        } catch (err) {
          // Transparent one-time failover: a flaky free model that 429s or hangs
          // gets retried on the reliable paid model so the turn still completes.
          if (!usedFallback && !signal.aborted && this.shouldFallback(err)) {
            this.logger.warn(
              `Primary model ${effectiveModel} failed (${err instanceof Error ? err.message : String(err)}); ` +
                `failing over to ${FALLBACK_MODEL} for thread ${threadId}`,
            );
            currentLlm = this.buildLlm(FALLBACK_MODEL, activeTools);
            usedFallback = true;
            response = await this.invokeWithTimeout(currentLlm, conversation, signal);
          } else {
            throw err;
          }
        }
        conversation.push(response);

        const calls = response.tool_calls ?? [];
        if (calls.length === 0) {
          // Final assistant response — emit body and finish.
          const text =
            typeof response.content === 'string'
              ? response.content
              : JSON.stringify(response.content);
          if (text.length > 0) {
            yield { type: 'token', text };
          }
          yield { type: 'done', response: text, toolCalls: toolCallRecords };
          // Best-effort, fire-and-forget memory extraction. Runs after 'done' so
          // it never blocks the stream; failures are swallowed inside the method.
          if (dino && userId) {
            void this.extractAndStoreMemories(userId, dino, message, text);
          }
          return;
        }

        // Execute each requested tool call, stream events as we go.
        for (const call of calls) {
          if (signal.aborted) return;
          const tool = activeTools.find((t) => t.name === call.name);
          const callId = call.id ?? `${call.name}-${iter}`;
          const args = (call.args ?? {}) as Record<string, unknown>;

          yield {
            type: 'tool_call_start',
            id: callId,
            name: call.name,
            args,
          };

          if (!tool) {
            const errResult = `Unknown tool: ${call.name}`;
            this.logger.warn(errResult);
            conversation.push(new ToolMessage({ content: errResult, tool_call_id: callId }));
            yield { type: 'tool_call_result', id: callId, result: errResult };
            toolCallRecords.push({ name: call.name, args, result: errResult });
            continue;
          }

          let resultStr: string;
          try {
            const raw = await tool.invoke(args);
            resultStr = typeof raw === 'string' ? raw : JSON.stringify(raw);
          } catch (err) {
            resultStr = `Tool error: ${err instanceof Error ? err.message : String(err)}`;
          }

          conversation.push(new ToolMessage({ content: resultStr, tool_call_id: callId }));
          yield { type: 'tool_call_result', id: callId, result: resultStr };
          toolCallRecords.push({ name: call.name, args, result: resultStr });
        }
      }

      // Hit the iteration cap without a final answer — emit what we have.
      this.logger.warn(`Tool loop hit max iterations (${MAX_TOOL_ITERATIONS}) for thread ${threadId}`);
      yield {
        type: 'done',
        response: '(Stopped after too many tool calls — try rephrasing your question.)',
        toolCalls: toolCallRecords,
      };
    } catch (error: unknown) {
      if (signal.aborted) {
        this.logger.log(`Agent stream aborted by client for thread ${threadId}`);
        return;
      }
      this.logger.error(
        `Agent stream error for model ${effectiveModel}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      if (error instanceof Error && error.message === 'LLM_TIMEOUT') {
        yield { type: 'error', message: 'The model took too long to respond (>20 s). Try again or switch to a different dino.' };
        return;
      }
      if (this.isCapabilityError(error)) {
        const modelSlug = effectiveModel.replace(':free', '');
        yield {
          type: 'error',
          message: 'This model is currently unavailable or has reached its usage limit.',
          link: `https://openrouter.ai/${modelSlug}`,
        };
        return;
      }
      yield { type: 'error', message: 'Failed to get a response from the model.' };
    }
  }

  /**
   * Dedicated image-generation path for artist dinos (IMG-01/02). Calls the
   * image model directly (LangChain's ChatOpenAI does not surface the `images`
   * field), then emits the caption text, the image as a StreamImageEvent, and
   * done. An attached image (if any) is forwarded so the model can edit it.
   */
  private async *streamImageGeneration(
    message: string,
    model: string,
    signal: AbortSignal,
    imageDataUrl: string | undefined,
    threadId: string,
  ): AsyncGenerator<StreamEvent, void, void> {
    const userContent = imageDataUrl
      ? [
          ...(message ? [{ type: 'text', text: message }] : []),
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ]
      : message;

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env['OPENROUTER_API_KEY']}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          modalities: ['image', 'text'],
          messages: [{ role: 'user', content: userContent }],
        }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(IMAGE_GEN_TIMEOUT_MS)]),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`${res.status} ${body}`.slice(0, 300));
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string; images?: { image_url?: { url?: string } }[] } }[];
      };
      const msg = data.choices?.[0]?.message ?? {};
      const text = typeof msg.content === 'string' ? msg.content : '';
      const imageUrl = msg.images?.[0]?.image_url?.url;

      if (text) yield { type: 'token', text };
      if (imageUrl) {
        yield { type: 'image', imageDataUrl: imageUrl };
      } else if (!text) {
        yield { type: 'token', text: '(No image was generated — try a different prompt.)' };
      }
      yield { type: 'done', response: text, toolCalls: [] };
    } catch (error: unknown) {
      if (signal.aborted) {
        this.logger.log(`Image generation aborted for thread ${threadId}`);
        return;
      }
      this.logger.error(
        `Image generation error: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (this.isCapabilityError(error)) {
        const modelSlug = model.replace(':free', '');
        yield {
          type: 'error',
          message: 'The image model is currently unavailable or has reached its usage limit.',
          link: `https://openrouter.ai/${modelSlug}`,
        };
        return;
      }
      yield { type: 'error', message: 'Failed to generate an image.' };
    }
  }

  /**
   * Assemble the dino system prompt: base persona → user-taught skills (standing
   * instructions) → auto-extracted memories (facts). Skills are deliberately a
   * separate, higher-authority block from memories. Empty blocks are omitted.
   */
  private buildSystemPrompt(basePrompt: string, skills: SkillView[], memories: string[]): string {
    let prompt = basePrompt;
    if (skills.length > 0) {
      const block = skills
        .map((s) =>
          s.whenToActivate
            ? `- ${s.title} (use when: ${s.whenToActivate}): ${s.instruction}`
            : `- ${s.title}: ${s.instruction}`,
        )
        .join('\n');
      prompt += `\n\n## MANDATORY STANDING INSTRUCTIONS\nThe user has configured the following behaviors. You MUST apply ALL of them in every single response, without exception, regardless of context:\n${block}`;
    }
    if (memories.length > 0) {
      const block = memories.map((m) => `- ${m}`).join('\n');
      prompt += `\n\nWhat you remember about this user:\n${block}`;
    }
    return prompt;
  }

  /**
   * Best-effort durable-fact extraction. Uses a small cheap model to pull 0–3
   * long-term facts about the USER from the just-finished turn and stores them.
   * Never throws — a failure here must never affect the chat.
   */
  private async extractAndStoreMemories(
    userId: string,
    dino: Dino,
    userMessage: string,
    assistantResponse: string,
  ): Promise<void> {
    try {
      const extractor = new ChatOpenAI({
        model: MEMORY_EXTRACTION_MODEL,
        apiKey: process.env['OPENROUTER_API_KEY'],
        configuration: { baseURL: 'https://openrouter.ai/api/v1' },
      });
      const instruction =
        'Extract 0-3 short, durable facts about the USER worth remembering long-term ' +
        '(preferences, identity, ongoing projects, goals). Ignore transient/one-off details ' +
        'and anything about the assistant. Reply with one fact per line, or exactly NONE if there are none.';
      const res = (await extractor.invoke([
        new SystemMessage(instruction),
        new HumanMessage(`User said:\n${userMessage}\n\nAssistant replied:\n${assistantResponse}`),
      ])) as AIMessage;
      const content = typeof res.content === 'string' ? res.content : '';
      const facts = content
        .split('\n')
        .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
        .filter((line) => line.length > 0 && line.toUpperCase() !== 'NONE')
        .slice(0, MAX_FACTS_PER_TURN);
      if (facts.length > 0) {
        await this.memoryService.writeMemories(userId, dino.id, facts);
      }
    } catch (err) {
      this.logger.warn(
        `Memory extraction failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
