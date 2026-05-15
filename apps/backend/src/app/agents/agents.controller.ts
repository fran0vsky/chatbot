import { Body, Controller, Post } from '@nestjs/common';
import { AgentsService } from './agents.service';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('chat')
  async chat(@Body() body: { message: string; threadId?: string }) {
    return this.agentsService.runAgent(body.message, body.threadId);
  }
}
