import { BadRequestException, Body, Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { GroupChatRequest, GroupStreamEvent } from '@org/shared-types';
import { GroupAgentsService } from './group-agents.service';

@Controller('agents')
export class GroupAgentsController {
  constructor(private readonly groupAgentsService: GroupAgentsService) {}

  @Post('group')
  async group(
    @Body() body: GroupChatRequest,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!body.message || body.message.trim().length === 0) {
      throw new BadRequestException('A non-empty message is required.');
    }
    if (!Array.isArray(body.participantDinoIds) || body.participantDinoIds.length === 0) {
      throw new BadRequestException('At least one participant dino is required.');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const controller = new AbortController();
    const onClose = (): void => controller.abort();
    req.on('close', onClose);

    const write = (event: GroupStreamEvent): void => {
      if (res.writableEnded) return;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      for await (const event of this.groupAgentsService.streamGroup(
        body.message,
        body.participantDinoIds,
        body.userId,
        body.history,
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
