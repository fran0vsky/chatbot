import { Injectable, Logger, HttpException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
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
  private readonly graphs = new Map<string, ReturnType<typeof this.buildGraph>>();

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

  async runAgent(message: string, threadId = 'default', model = 'openai/gpt-4o-mini'): Promise<{ response: string }> {
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

      return { response };
    } catch (error: unknown) {
      this.logger.error(`Agent error for model ${model}: ${error instanceof Error ? error.message : String(error)}`);

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
