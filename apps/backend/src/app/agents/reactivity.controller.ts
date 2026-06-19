import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { ReactivityResponse, SetReactivityRequest } from '@org/shared-types';
import { ReactivityService } from './reactivity.service';

/**
 * Thin REST controller for per-dino when-to-react levels.
 * Business logic lives in ReactivityService.
 *
 * GET  /api/dino-reactivity?userId=   → { levels: DinoReactivityMap }
 * PUT  /api/dino-reactivity/:dinoId   body { userId, level } → { dinoId, level }
 */
@Controller('dino-reactivity')
export class ReactivityController {
  constructor(private readonly reactivityService: ReactivityService) {}

  /** Return all stored reaction levels for the given user. */
  @Get()
  async getLevels(@Query('userId') userId: string): Promise<ReactivityResponse> {
    const levels = await this.reactivityService.getLevels(userId ?? '');
    return { levels };
  }

  /** Upsert the reaction level for one dino. */
  @Put(':dinoId')
  async setLevel(
    @Param('dinoId') dinoId: string,
    @Body() body: SetReactivityRequest,
  ): Promise<{ dinoId: string; level: string }> {
    return this.reactivityService.setLevel(body.userId, dinoId, body.level);
  }
}
