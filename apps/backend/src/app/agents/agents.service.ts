import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
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
import { ToolCallRecord } from '@org/shared-types';
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

  async runAgent(
    message: string,
    threadId = 'default',
    model = 'openai/gpt-4o-mini',
  ): Promise<{ response: string; toolCalls: ToolCallRecord[] }> {
    this.logger.log(`Running agent for thread ${threadId} with model ${model}`);

    const graph = this.getOrBuildGraph(model);

    try {
      const result = await graph.invoke(
        { messages: [new HumanMessage(message)] },
        { configurable: { thread_id: threadId } },
      );

      const lastMessage = result.messages[result.messages.length - 1];
      const response =
        typeof lastMessage.content === 'string'
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      const toolCalls = this.extractTurnToolCalls(result.messages);

      return { response, toolCalls };
    } catch (error: unknown) {
      this.logger.error(
        `Agent error for model ${model}: ${error instanceof Error ? error.message : String(error)}`,
      );

      if (this.isCapabilityError(error)) {
        const modelSlug = model.replace(':free', '');
        throw new HttpException(
          {
            message: 'This model is currently unavailable or has reached its usage limit.',
            link: `https://openrouter.ai/${modelSlug}`,
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      throw new InternalServerErrorException('Failed to get a response from the model.');
    }
  }
}
