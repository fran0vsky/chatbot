import { Body, Controller, Post } from '@nestjs/common';
import { ChatRequest, ChatResponse } from '@org/shared-types';
import { AgentsService } from './agents.service';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('chat')
  async chat(@Body() body: ChatRequest): Promise<ChatResponse> {
    return this.agentsService.runAgent(body.message, body.threadId, body.model);
  }
}
