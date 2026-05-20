import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, BaseMessage } from '@langchain/core/messages';
import { StateGraph, END, START, Annotation, MemorySaver } from '@langchain/langgraph';

const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
});

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);
  private readonly checkpointer = new MemorySaver();
  private readonly SUPPORTED_MODELS = ['openai/gpt-4o-mini', 'anthropic/claude-3-haiku'] as const;
  private readonly graphs = new Map<string, ReturnType<typeof this.buildGraph>>();

  constructor() {
    for (const modelId of this.SUPPORTED_MODELS) {
      this.graphs.set(modelId, this.buildGraph(modelId));
    }
  }

  private buildGraph(modelId: string) {
    const model = new ChatOpenAI({
      apiKey: process.env['OPENROUTER_API_KEY'],
      modelName: modelId,
      configuration: { baseURL: 'https://openrouter.ai/api/v1' },
    });

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

  async runAgent(message: string, threadId = 'default', model = 'openai/gpt-4o-mini'): Promise<{ response: string }> {
    this.logger.log(`Running agent for thread ${threadId}: ${message}`);

    const graph = this.graphs.get(model) ?? this.graphs.get('openai/gpt-4o-mini')!;

    const result = await graph.invoke(
      { messages: [new HumanMessage(message)] },
      { configurable: { thread_id: threadId } },
    );

    const lastMessage = result.messages[result.messages.length - 1];
    const response =
      typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    return { response };
  }
}
