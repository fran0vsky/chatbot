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

export interface ConversationSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  pinned?: boolean;
}
