export interface ChatRequest {
  message: string;
  threadId?: string;
  model?: string;
}

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: string;
}

export interface ChatResponse {
  response: string;
  toolCalls?: ToolCallRecord[];
}

export type MessageRole = 'user' | 'assistant' | 'error' | 'tool';

export interface ChatMessage {
  text: string;
  role: MessageRole;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  reasoning?: string;
  reasoningDurationMs?: number;
}

export interface ConversationSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  pinned?: boolean;
}

export interface StreamTokenEvent {
  type: 'token';
  text: string;
}

export interface StreamToolCallStartEvent {
  type: 'tool_call_start';
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface StreamToolCallResultEvent {
  type: 'tool_call_result';
  id: string;
  result: string;
}

export interface StreamReasoningTokenEvent {
  type: 'reasoning_token';
  text: string;
}

export interface StreamDoneEvent {
  type: 'done';
  response: string;
  toolCalls?: ToolCallRecord[];
  reasoning?: string;
  reasoningDurationMs?: number;
}

export interface StreamErrorEvent {
  type: 'error';
  message: string;
  link?: string;
}

export type StreamEvent =
  | StreamTokenEvent
  | StreamReasoningTokenEvent
  | StreamToolCallStartEvent
  | StreamToolCallResultEvent
  | StreamDoneEvent
  | StreamErrorEvent;
