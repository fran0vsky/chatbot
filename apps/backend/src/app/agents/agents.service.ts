import { Injectable, Logger } from '@nestjs/common';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
});

const searchTool = tool(
  async ({ query }: { query: string }) => {
    return `Search results for "${query}": [This is a placeholder — wire up a real search API here.]`;
  },
  {
    name: 'search',
    description: 'Search the web for information',
    schema: z.object({ query: z.string().describe('The search query') }),
  },
);

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);
  private readonly model: ChatAnthropic;
  private readonly graph: ReturnType<typeof this.buildGraph>;
  private readonly checkpointer = new MemorySaver();

  constructor() {
    this.model = new ChatAnthropic({
      model: 'claude-sonnet-4-6',
      apiKey: process.env['ANTHROPIC_API_KEY'],
    });
    this.graph = this.buildGraph();
  }

  private buildGraph() {
    const tools = [searchTool];
    const modelWithTools = this.model.bindTools(tools);

    const callModel = async (state: typeof AgentState.State) => {
      const response = await modelWithTools.invoke(state.messages);
      return { messages: [response] };
    };

    const shouldContinue = (state: typeof AgentState.State) => {
      const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
      if (lastMessage.tool_calls?.length) return 'tools';
      return END;
    };

    const callTools = async (state: typeof AgentState.State) => {
      const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
      const results: BaseMessage[] = [];
      for (const toolCall of lastMessage.tool_calls ?? []) {
        if (toolCall.name === 'search') {
          const result = await searchTool.invoke(toolCall.args as { query: string });
          results.push({ role: 'tool', content: result, tool_call_id: toolCall.id } as unknown as BaseMessage);
        }
      }
      return { messages: results };
    };

    const workflow = new StateGraph(AgentState)
      .addNode('agent', callModel)
      .addNode('tools', callTools)
      .addEdge(START, 'agent')
      .addConditionalEdges('agent', shouldContinue)
      .addEdge('tools', 'agent');

    return workflow.compile({ checkpointer: this.checkpointer });
  }

  async runAgent(message: string, threadId = 'default'): Promise<{ response: string }> {
    this.logger.log(`Running agent for thread ${threadId}: ${message}`);

    const result = await this.graph.invoke(
      { messages: [new HumanMessage(message)] },
      { configurable: { thread_id: threadId } },
    );

    const lastMessage = result.messages[result.messages.length - 1];
    const response = typeof lastMessage.content === 'string'
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

    return { response };
  }
}
