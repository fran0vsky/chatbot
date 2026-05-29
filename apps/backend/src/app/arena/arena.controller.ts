import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ArenaService } from './arena.service';
import { ArenaVote } from '@org/shared-types';

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
    await this.arenaService.recordVote(vote);
  }

  @Get('leaderboard')
  async getLeaderboard() {
    return this.arenaService.getLeaderboard();
  }
}
