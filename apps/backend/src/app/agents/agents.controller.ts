import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ChatRequest, StreamEvent } from '@org/shared-types';
import { AgentsService } from './agents.service';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('chat')
  async chat(
    @Body() body: ChatRequest,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const controller = new AbortController();
    const onClose = (): void => controller.abort();
    req.on('close', onClose);

    const write = (event: StreamEvent): void => {
      if (res.writableEnded) return;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      for await (const event of this.agentsService.streamAgent(
        body.message,
        body.threadId,
        body.model,
        controller.signal,
      )) {
        write(event);
      }
    } finally {
      req.off('close', onClose);
      if (!res.writableEnded) res.end();
    }
  }
}
