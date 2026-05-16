export interface ChatRequest {
  message: string;
  threadId?: string;
}

export interface ChatResponse {
  response: string;
}
