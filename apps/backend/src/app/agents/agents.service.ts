import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { StreamEvent, ToolCallRecord } from '@org/shared-types';
import { tools } from './tools';
import { getDino } from './dinos';

const MAX_TOOL_ITERATIONS = 5;

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

  private isCapabilityError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    return (
      msg.includes('402') ||
      msg.includes('429') ||
      msg.includes('rate limit') ||
      msg.includes('no endpoints') ||
      msg.includes('quota') ||
      msg.includes('context length') ||
      msg.includes('model not found')
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
      const llmBase = new ChatOpenAI({
        model: effectiveModel,
        apiKey: process.env['OPENROUTER_API_KEY'],
        configuration: { baseURL: 'https://openrouter.ai/api/v1' },
      });
      const llm = activeTools.length > 0 ? llmBase.bindTools(activeTools) : llmBase;

      const conversation: BaseMessage[] = dino
        ? [new SystemMessage(dino.systemPrompt), new HumanMessage(message)]
        : [new HumanMessage(message)];
      const toolCallRecords: ToolCallRecord[] = [];

      for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
        if (signal.aborted) return;

        const response = (await llm.invoke(conversation, { signal })) as AIMessage;
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
}
