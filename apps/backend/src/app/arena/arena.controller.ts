import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ArenaService } from './arena.service';
import { ArenaVote } from '@org/shared-types';

const VALID_RESULTS: ReadonlySet<ArenaVote['result']> = new Set([
  'a',
  'b',
  'draw',
]);

/**
 * HTTP layer for the Dino Arena.
 *
 * GET  /api/arena/matchup     — pick two random dinos for a match
 * POST /api/arena/vote        — record the user's vote
 * GET  /api/arena/leaderboard — return all dinos ranked by rating
 */
@Controller('arena')
export class ArenaController {
  constructor(private readonly arenaService: ArenaService) {}

  @Get('matchup')
  getMatchup(): { aDinoId: string; bDinoId: string } {
    return this.arenaService.getMatchup();
  }

  @Post('vote')
  @HttpCode(HttpStatus.NO_CONTENT)
  async recordVote(@Body() vote: ArenaVote): Promise<void> {
    // No global ValidationPipe is registered, so validate the request contract
    // here. An invalid `result` would otherwise reach updateElo's switch with no
    // matching case, producing NaN ratings persisted to the DB (CR-01).
    if (!vote || typeof vote !== 'object') {
      throw new BadRequestException('Vote body is required.');
    }
    if (typeof vote.aDinoId !== 'string' || vote.aDinoId.length === 0) {
      throw new BadRequestException('aDinoId must be a non-empty string.');
    }
    if (typeof vote.bDinoId !== 'string' || vote.bDinoId.length === 0) {
      throw new BadRequestException('bDinoId must be a non-empty string.');
    }
    if (!VALID_RESULTS.has(vote.result)) {
      throw new BadRequestException(
        "result must be one of 'a', 'b', or 'draw'.",
      );
    }
    // A dino cannot battle itself — would corrupt its own counters (CR-03).
    if (vote.aDinoId === vote.bDinoId) {
      throw new BadRequestException('aDinoId and bDinoId must differ.');
    }

    await this.arenaService.recordVote(vote);
  }

  @Get('leaderboard')
  async getLeaderboard() {
    return this.arenaService.getLeaderboard();
  }
}
