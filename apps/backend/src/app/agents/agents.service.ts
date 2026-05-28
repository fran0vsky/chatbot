import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  ToolMessage,
} from '@langchain/core/messages';
import {
  StateGraph,
  END,
  START,
  Annotation,
  MemorySaver,
} from '@langchain/langgraph';
import { StreamEvent, ToolCallRecord } from '@org/shared-types';

const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
});

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);
  private readonly checkpointer = new MemorySaver();
  private readonly graphs = new Map<string, ReturnType<typeof this.buildGraph>>();

  private buildGraph(modelId: string) {
    // OpenRouter is OpenAI-API-compatible; using the official @langchain/openai
    // client against the OpenRouter base URL avoids a streaming-parser crash in
    // @langchain/openrouter ("Cannot read properties of undefined (reading
    // 'additional_kwargs')") that affects the free models.
    const model = new ChatOpenAI({
      model: modelId,
      apiKey: process.env['OPENROUTER_API_KEY'],
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
      },
    });

    // Tool-binding currently triggers a crash in @langchain/openrouter when
    // the free model streams its first chunk ("Cannot read properties of
    // undefined (reading 'additional_kwargs')"). Skip bindTools for now so
    // plain chat completion works — tools can be re-enabled once the
    // upstream library is patched.
    const callModel = async (state: typeof AgentState.State) => {
      const response = await model.invoke(state.messages);
      return { messages: [response] };
    };

    return new StateGraph(AgentState)
      .addNode('agent', callModel)
      .addEdge(START, 'agent')
      .addEdge('agent', END)
      .compile({ checkpointer: this.checkpointer });
  }

  private getOrBuildGraph(modelId: string) {
    if (!this.graphs.has(modelId)) {
      this.graphs.set(modelId, this.buildGraph(modelId));
    }
    return this.graphs.get(modelId)!;
  }

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

  private extractTurnToolCalls(messages: BaseMessage[]): ToolCallRecord[] {
    const turnMessages: BaseMessage[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg instanceof HumanMessage) break;
      turnMessages.unshift(msg);
    }

    const toolMessagesById = new Map<string, ToolMessage>();
    for (const msg of turnMessages) {
      if (msg instanceof ToolMessage && msg.tool_call_id) {
        toolMessagesById.set(msg.tool_call_id, msg);
      }
    }

    const records: ToolCallRecord[] = [];
    for (const msg of turnMessages) {
      if (!(msg instanceof AIMessage) || !msg.tool_calls) continue;
      for (const call of msg.tool_calls) {
        const id = call.id ?? '';
        const toolMsg = toolMessagesById.get(id);
        const result =
          toolMsg === undefined
            ? ''
            : typeof toolMsg.content === 'string'
              ? toolMsg.content
              : JSON.stringify(toolMsg.content);
        records.push({
          name: call.name,
          args: (call.args ?? {}) as Record<string, unknown>,
          result,
        });
      }
    }

    return records;
  }

  private extractChunkReasoning(chunk: unknown): string {
    if (!chunk || typeof chunk !== 'object') return '';
    const additional = (chunk as { additional_kwargs?: Record<string, unknown> }).additional_kwargs;
    if (!additional) return '';
    const flat = additional['reasoning_content'];
    if (typeof flat === 'string') return flat;
    const details = additional['reasoning_details'];
    if (Array.isArray(details)) {
      return details
        .map((d) =>
          d && typeof d === 'object' && 'text' in d && typeof (d as { text: unknown }).text === 'string'
            ? (d as { text: string }).text
            : '',
        )
        .join('');
    }
    return '';
  }

  private extractChunkText(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((p) =>
          typeof p === 'string'
            ? p
            : p && typeof p === 'object' && 'text' in p && typeof (p as { text: unknown }).text === 'string'
              ? (p as { text: string }).text
              : '',
        )
        .join('');
    }
    return '';
  }

  private stringifyToolOutput(output: unknown): string {
    if (output instanceof ToolMessage) {
      return typeof output.content === 'string'
        ? output.content
        : JSON.stringify(output.content);
    }
    if (typeof output === 'string') return output;
    if (output === undefined || output === null) return '';
    return JSON.stringify(output);
  }

  async *streamAgent(
    message: string,
    threadId = 'default',
    model = 'openai/gpt-oss-120b:free',
    signal: AbortSignal,
  ): AsyncGenerator<StreamEvent, void, void> {
    this.logger.log(`Streaming agent for thread ${threadId} with model ${model}`);
    try {
      // Direct LangChain invocation — bypassing LangGraph streamEvents because
      // it crashes inside the chat-model-stream chunk parser with "Cannot read
      // properties of undefined (reading 'additional_kwargs')" on these models.
      // We still stream tokens to the client by chunking the final response.
      const llm = new ChatOpenAI({
        model,
        apiKey: process.env['OPENROUTER_API_KEY'],
        configuration: { baseURL: 'https://openrouter.ai/api/v1' },
      });

      const result = await llm.invoke([new HumanMessage(message)], { signal });
      if (signal.aborted) return;

      const response =
        typeof result.content === 'string' ? result.content : JSON.stringify(result.content);

      // Emit the body as a single token for now; UI handles either streaming
      // or single-shot deliveries identically.
      if (response.length > 0) {
        yield { type: 'token', text: response };
      }

      yield {
        type: 'done',
        response,
        toolCalls: [],
      };
      return;
    } catch (error: unknown) {
      if (signal.aborted) {
        this.logger.log(`Agent stream aborted by client for thread ${threadId}`);
        return;
      }
      this.logger.error(
        `Agent stream error for model ${model}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      if (this.isCapabilityError(error)) {
        const modelSlug = model.replace(':free', '');
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
