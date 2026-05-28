import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { StreamEvent, ToolCallRecord } from '@org/shared-types';
import { tools } from './tools';

const MAX_TOOL_ITERATIONS = 5;

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
  ): AsyncGenerator<StreamEvent, void, void> {
    this.logger.log(`Streaming agent for thread ${threadId} with model ${model}`);

    try {
      const llm = new ChatOpenAI({
        model,
        apiKey: process.env['OPENROUTER_API_KEY'],
        configuration: { baseURL: 'https://openrouter.ai/api/v1' },
      }).bindTools([...tools]);

      const conversation: BaseMessage[] = [new HumanMessage(message)];
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
          const tool = tools.find((t) => t.name === call.name);
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
