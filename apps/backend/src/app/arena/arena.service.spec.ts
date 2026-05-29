import { describe, it, expect, beforeEach } from 'vitest';
import { ArenaService } from './arena.service.js';
import { DINOS } from '../agents/dinos/dinos.js';
import { DEFAULT_RATING } from './elo.js';
import { ArenaVote } from '@org/shared-types';

// ─── Fake DB helpers ──────────────────────────────────────────────────────────

/** In-memory store for rating rows, keyed by dinoId. */
type FakeRow = {
  dinoId: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  games: number;
  updatedAt: Date;
};

/**
 * Build a minimal fake db that correctly handles both usage patterns:
 * 1. db.select().from(table)                   — getLeaderboard (returns array)
 * 2. db.select().from(table).where().limit(n)  — loadOrDefault  (returns promise)
 */
function buildFakeDb(store: Map<string, FakeRow>) {
  const allRows = () => Array.from(store.values());

  return {
    store,
    select: () => ({
      from: () => {
        const base = {
          // For leaderboard: awaiting the from() result itself (it's then-able)
          then: (resolve: (rows: FakeRow[]) => void, _reject?: unknown) =>
            Promise.resolve(allRows()).then(resolve),
          // For loadOrDefault: chaining .where().limit()
          where: (_cond: unknown) => ({
            limit: (_n: number) => {
              return Promise.resolve(allRows());
            },
          }),
        };
        // Make from() itself a thenable (Promise-like) for getLeaderboard's `await`
        return Object.assign(Promise.resolve(allRows()), base);
      },
    }),
    insert: (_table: unknown) => ({
      values: (row: FakeRow) => ({
        onConflictDoUpdate: (_opts: unknown) => {
          store.set(row.dinoId, { ...row });
          return Promise.resolve();
        },
      }),
    }),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeService(db: ReturnType<typeof buildFakeDb> | null): ArenaService {
  // NestJS Inject is resolved at runtime; in tests we manually pass the dep.
  const connection = { db, pool: null };
  // @ts-expect-error — bypass DI container in unit tests
  const service = new ArenaService(connection);
  return service;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ArenaService', () => {
  describe('getMatchup', () => {
    it('returns two distinct dino ids from the registry', () => {
      const service = makeService(null);
      const { aDinoId, bDinoId } = service.getMatchup();
      expect(aDinoId).not.toBe(bDinoId);
      const ids = DINOS.map((d) => d.id);
      expect(ids).toContain(aDinoId);
      expect(ids).toContain(bDinoId);
    });

    it('works without a DB connection (null db)', () => {
      const service = makeService(null);
      expect(() => service.getMatchup()).not.toThrow();
    });
  });

  describe('recordVote — with DB', () => {
    let store: Map<string, FakeRow>;
    let service: ArenaService;

    beforeEach(() => {
      store = new Map();
      const fakeDb = buildFakeDb(store);
      service = makeService(fakeDb);
    });

    it('creates rows for both dinos on first vote', async () => {
      const vote: ArenaVote = { aDinoId: 'rexford', bDinoId: 'veloce', result: 'a' };
      await service.recordVote(vote);
      expect(store.has('rexford')).toBe(true);
      expect(store.has('veloce')).toBe(true);
    });

    it('winner gains rating, loser loses rating', async () => {
      const vote: ArenaVote = { aDinoId: 'rexford', bDinoId: 'veloce', result: 'a' };
      await service.recordVote(vote);
      const rexford = store.get('rexford');
      const veloce = store.get('veloce');
      expect(rexford).toBeDefined();
      expect(veloce).toBeDefined();
      if (rexford && veloce) {
        expect(rexford.rating).toBeGreaterThan(DEFAULT_RATING);
        expect(veloce.rating).toBeLessThan(DEFAULT_RATING);
      }
    });

    it('winner wins counter increments, loser losses counter increments', async () => {
      const vote: ArenaVote = { aDinoId: 'rexford', bDinoId: 'veloce', result: 'a' };
      await service.recordVote(vote);
      const rexford = store.get('rexford');
      const veloce = store.get('veloce');
      expect(rexford).toBeDefined();
      expect(veloce).toBeDefined();
      if (rexford && veloce) {
        expect(rexford.wins).toBe(1);
        expect(rexford.losses).toBe(0);
        expect(veloce.wins).toBe(0);
        expect(veloce.losses).toBe(1);
      }
    });

    it('draw increments draws for both dinos', async () => {
      const vote: ArenaVote = { aDinoId: 'rexford', bDinoId: 'veloce', result: 'draw' };
      await service.recordVote(vote);
      const rexford = store.get('rexford');
      const veloce = store.get('veloce');
      expect(rexford).toBeDefined();
      expect(veloce).toBeDefined();
      if (rexford && veloce) {
        expect(rexford.draws).toBe(1);
        expect(veloce.draws).toBe(1);
      }
    });

    it('games counter increments for both dinos on each vote', async () => {
      await service.recordVote({ aDinoId: 'rexford', bDinoId: 'veloce', result: 'a' });
      await service.recordVote({ aDinoId: 'rexford', bDinoId: 'veloce', result: 'b' });
      const rexford = store.get('rexford');
      const veloce = store.get('veloce');
      expect(rexford).toBeDefined();
      expect(veloce).toBeDefined();
      if (rexford && veloce) {
        expect(rexford.games).toBe(2);
        expect(veloce.games).toBe(2);
      }
    });
  });

  describe('recordVote — null DB (no-op)', () => {
    it('does not throw when DB is unavailable', async () => {
      const service = makeService(null);
      const vote: ArenaVote = { aDinoId: 'rexford', bDinoId: 'veloce', result: 'a' };
      await expect(service.recordVote(vote)).resolves.toBeUndefined();
    });
  });

  describe('getLeaderboard — with DB', () => {
    it('returns all dinos sorted by rating descending', async () => {
      const store: Map<string, FakeRow> = new Map([
        ['rexford', { dinoId: 'rexford', rating: 1050, wins: 2, losses: 0, draws: 0, games: 2, updatedAt: new Date() }],
        ['veloce', { dinoId: 'veloce', rating: 950, wins: 0, losses: 2, draws: 0, games: 2, updatedAt: new Date() }],
      ]);
      const service = makeService(buildFakeDb(store));
      const rows = await service.getLeaderboard();
      expect(rows[0].rating).toBeGreaterThanOrEqual(rows[1].rating);
      // All dinos from registry are present
      const ids = rows.map((r) => r.dinoId);
      for (const dino of DINOS) {
        expect(ids).toContain(dino.id);
      }
    });

    it('dinos with no rating row appear at DEFAULT_RATING', async () => {
      const store: Map<string, FakeRow> = new Map();
      const service = makeService(buildFakeDb(store));
      const rows = await service.getLeaderboard();
      for (const row of rows) {
        expect(row.rating).toBe(DEFAULT_RATING);
        expect(row.games).toBe(0);
      }
    });

    it('each row has name and species from the registry', async () => {
      const store: Map<string, FakeRow> = new Map();
      const service = makeService(buildFakeDb(store));
      const rows = await service.getLeaderboard();
      for (const row of rows) {
        const dino = DINOS.find((d) => d.id === row.dinoId);
        expect(dino).toBeDefined();
        if (dino) {
          expect(row.name).toBe(dino.name);
          expect(row.species).toBe(dino.species);
        }
      }
    });
  });

  describe('getLeaderboard — null DB (fallback)', () => {
    it('returns all registry dinos at DEFAULT_RATING when DB is off', async () => {
      const service = makeService(null);
      const rows = await service.getLeaderboard();
      expect(rows).toHaveLength(DINOS.length);
      for (const row of rows) {
        expect(row.rating).toBe(DEFAULT_RATING);
        expect(row.games).toBe(0);
      }
    });

    it('does not throw', async () => {
      const service = makeService(null);
      await expect(service.getLeaderboard()).resolves.toBeDefined();
    });
  });
});
