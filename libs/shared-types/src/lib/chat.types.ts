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
}

export interface ConversationSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  pinned?: boolean;
}
