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
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { StreamEvent, ToolCallRecord } from '@org/shared-types';
import { tools } from './tools';

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
    const model = new ChatOpenAI({
      apiKey: process.env['OPENROUTER_API_KEY'],
      modelName: modelId,
      configuration: { baseURL: 'https://openrouter.ai/api/v1' },
    });

    const boundModel = model.bindTools([...tools]);
    const toolNode = new ToolNode([...tools]);

    const callModel = async (state: typeof AgentState.State) => {
      const response = await boundModel.invoke(state.messages);
      return { messages: [response] };
    };

    const shouldContinue = (state: typeof AgentState.State): 'tools' | typeof END => {
      const last = state.messages[state.messages.length - 1];
      if (last instanceof AIMessage && last.tool_calls && last.tool_calls.length > 0) {
        return 'tools';
      }
      return END;
    };

    return new StateGraph(AgentState)
      .addNode('agent', callModel)
      .addNode('tools', toolNode)
      .addEdge(START, 'agent')
      .addConditionalEdges('agent', shouldContinue, { tools: 'tools', [END]: END })
      .addEdge('tools', 'agent')
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
    model = 'openai/gpt-4o-mini',
    signal: AbortSignal,
  ): AsyncGenerator<StreamEvent, void, void> {
    this.logger.log(`Streaming agent for thread ${threadId} with model ${model}`);
    const graph = this.getOrBuildGraph(model);
    try {
      const stream = graph.streamEvents(
        { messages: [new HumanMessage(message)] },
        { configurable: { thread_id: threadId }, version: 'v2', signal },
      );

      for await (const ev of stream) {
        if (signal.aborted) return;
        if (ev.event === 'on_chat_model_stream') {
          const chunk = (ev.data as { chunk?: { content?: unknown } })?.chunk;
          const text = this.extractChunkText(chunk?.content);
          if (text.length > 0) yield { type: 'token', text };
        } else if (ev.event === 'on_tool_start') {
          const input = (ev.data as { input?: unknown })?.input;
          const args =
            input && typeof input === 'object' && !Array.isArray(input)
              ? (input as Record<string, unknown>)
              : { input };
          yield {
            type: 'tool_call_start',
            id: ev.run_id,
            name: ev.name,
            args,
          };
        } else if (ev.event === 'on_tool_end') {
          const output = (ev.data as { output?: unknown })?.output;
          yield {
            type: 'tool_call_result',
            id: ev.run_id,
            result: this.stringifyToolOutput(output),
          };
        }
      }

      if (signal.aborted) return;

      const state = await graph.getState({ configurable: { thread_id: threadId } });
      const messages = (state.values as { messages: BaseMessage[] }).messages;
      const last = messages[messages.length - 1];
      const response =
        typeof last.content === 'string' ? last.content : JSON.stringify(last.content);
      const toolCalls = this.extractTurnToolCalls(messages);
      yield { type: 'done', response, toolCalls };
    } catch (error: unknown) {
      if (signal.aborted) {
        this.logger.log(`Agent stream aborted by client for thread ${threadId}`);
        return;
      }
      this.logger.error(
        `Agent stream error for model ${model}: ${error instanceof Error ? error.message : String(error)}`,
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
