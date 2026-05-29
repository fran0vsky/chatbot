import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ArenaController } from './arena.controller.js';
import { ArenaService } from './arena.service.js';
import { ArenaVote } from '@org/shared-types';

/**
 * The controller is the only validation boundary for POST /api/arena/vote
 * (no global ValidationPipe is registered), so these tests lock in the
 * request-contract guards that protect the Elo write path (CR-01, CR-03).
 */
describe('ArenaController.recordVote validation', () => {
  let controller: ArenaController;
  let recordVote: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    recordVote = vi.fn().mockResolvedValue(undefined);
    const service = { recordVote } as unknown as ArenaService;
    controller = new ArenaController(service);
  });

  const validVote: ArenaVote = { aDinoId: 'rexford', bDinoId: 'veloce', result: 'a' };

  it('forwards a valid vote to the service', async () => {
    await controller.recordVote(validVote);
    expect(recordVote).toHaveBeenCalledWith(validVote);
  });

  it('rejects an invalid result (would otherwise persist NaN ratings)', async () => {
    const bad = { ...validVote, result: 'winner' as ArenaVote['result'] };
    await expect(controller.recordVote(bad)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(recordVote).not.toHaveBeenCalled();
  });

  it('rejects a missing result', async () => {
    const bad = { aDinoId: 'rexford', bDinoId: 'veloce' } as ArenaVote;
    await expect(controller.recordVote(bad)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(recordVote).not.toHaveBeenCalled();
  });

  it('rejects a self-match (would corrupt a dino\'s own counters)', async () => {
    const bad: ArenaVote = { aDinoId: 'rexford', bDinoId: 'rexford', result: 'a' };
    await expect(controller.recordVote(bad)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(recordVote).not.toHaveBeenCalled();
  });

  it('rejects empty dino ids', async () => {
    const bad: ArenaVote = { aDinoId: '', bDinoId: 'veloce', result: 'a' };
    await expect(controller.recordVote(bad)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(recordVote).not.toHaveBeenCalled();
  });
});
