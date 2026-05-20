export interface ChatRequest {
  message: string;
  threadId?: string;
  model?: string;
}

export interface ChatResponse {
  response: string;
}

export type MessageRole = 'user' | 'assistant' | 'error';

export interface ChatMessage {
  text: string;
  role: MessageRole;
}
