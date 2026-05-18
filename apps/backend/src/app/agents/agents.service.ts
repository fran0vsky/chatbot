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
  private readonly model: ChatOpenAI;
  private readonly graph: ReturnType<typeof this.buildGraph>;
  private readonly checkpointer = new MemorySaver();

  constructor() {
    this.model = new ChatOpenAI({
      apiKey: process.env['OPENROUTER_API_KEY'],
      modelName: 'openai/gpt-4o-mini',
      configuration: { baseURL: 'https://openrouter.ai/api/v1' },
    });
    this.graph = this.buildGraph();
  }

  private buildGraph() {
    const callModel = async (state: typeof AgentState.State) => {
      const response = await this.model.invoke(state.messages);
      return { messages: [response] };
    };

    const workflow = new StateGraph(AgentState)
      .addNode('agent', callModel)
      .addEdge(START, 'agent')
      .addEdge('agent', END);

    return workflow.compile({ checkpointer: this.checkpointer });
  }

  async runAgent(message: string, threadId = 'default'): Promise<{ response: string }> {
    this.logger.log(`Running agent for thread ${threadId}: ${message}`);

    const result = await this.graph.invoke(
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
