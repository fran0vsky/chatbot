export interface ChatRequest {
  message: string;
  threadId?: string;
  model?: string;
}

export interface ChatResponse {
  response: string;
}
