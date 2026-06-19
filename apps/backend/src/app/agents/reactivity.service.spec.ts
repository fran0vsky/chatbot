import { BadRequestException } from '@nestjs/common';
import { describe, it, expect } from 'vitest';
import { ReactivityService } from './reactivity.service';

// A minimal thenable Drizzle stand-in following the memory.service.spec.ts pattern.
// Supports select chains and insert with onConflictDoUpdate.
function makeFakeDb(selectRows: Array<Record<string, unknown>> = []) {
  const upserted: Array<Record<string, unknown>> = [];

  const selectBuilder: Record<string, unknown> = {
    from: () => selectBuilder,
    where: () => selectBuilder,
    then: (resolve: (rows: unknown) => unknown) => resolve(selectRows),
  };

  const conflictBuilder = {
    onConflictDoUpdate: (opts: Record<string, unknown>) => {
      upserted.push(opts);
      return Promise.resolve();
    },
  };

  return {
    db: {
      select: () => selectBuilder,
      insert: () => ({
        values: (vals: Record<string, unknown>) => {
          upserted.push(vals);
          return conflictBuilder;
        },
      }),
    } as never,
    upserted,
  };
}

describe('ReactivityService — graceful degradation (db null)', () => {
  const svc = new ReactivityService({ db: null, pool: null });

  it('getLevels returns {} when DB is disabled', async () => {
    await expect(svc.getLevels('u1')).resolves.toEqual({});
  });

  it('getLevels returns {} when userId is empty', async () => {
    await expect(svc.getLevels('')).resolves.toEqual({});
  });

  it('setLevel returns { dinoId, level } without throwing when DB is disabled', async () => {
    await expect(svc.setLevel('u1', 'rexford', 'chatty')).resolves.toEqual({
      dinoId: 'rexford',
      level: 'chatty',
    });
  });

  it('setLevel returns { dinoId, level } without throwing when userId is empty', async () => {
    await expect(svc.setLevel('', 'rexford', 'rarely')).resolves.toEqual({
      dinoId: 'rexford',
      level: 'rarely',
    });
  });
});

describe('ReactivityService — level validation', () => {
  const svc = new ReactivityService({ db: null, pool: null });

  it('throws BadRequestException for an unknown level', async () => {
    await expect(
      svc.setLevel('u1', 'rexford', 'loud' as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws BadRequestException for empty string level', async () => {
    await expect(
      svc.setLevel('u1', 'rexford', '' as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does NOT throw for all valid REACTION_LEVELS', async () => {
    for (const level of ['never', 'rarely', 'normal', 'chatty'] as const) {
      await expect(svc.setLevel('', 'rexford', level)).resolves.toMatchObject({ level });
    }
  });
});

describe('ReactivityService — happy path with fake db', () => {
  it('getLevels maps rows to DinoReactivityMap', async () => {
    const fake = makeFakeDb([
      { dinoId: 'rexford', level: 'chatty' },
      { dinoId: 'veloce', level: 'rarely' },
    ]);
    const svc = new ReactivityService({ db: fake.db, pool: null });
    await expect(svc.getLevels('u1')).resolves.toEqual({
      rexford: 'chatty',
      veloce: 'rarely',
    });
  });

  it('getLevels returns {} when no rows stored', async () => {
    const fake = makeFakeDb([]);
    const svc = new ReactivityService({ db: fake.db, pool: null });
    await expect(svc.getLevels('u1')).resolves.toEqual({});
  });

  it('setLevel returns { dinoId, level } on valid upsert', async () => {
    const fake = makeFakeDb();
    const svc = new ReactivityService({ db: fake.db, pool: null });
    const result = await svc.setLevel('u1', 'rexford', 'chatty');
    expect(result).toEqual({ dinoId: 'rexford', level: 'chatty' });
    expect(fake.upserted.length).toBeGreaterThan(0);
  });
});
