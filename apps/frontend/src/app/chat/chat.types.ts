export type MessageRole = 'user' | 'assistant' | 'error';

export interface ChatMessage {
  text: string;
  role: MessageRole;
}
