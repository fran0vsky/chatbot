import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../database/database.module';
import { dinoRatings } from '../database/schema';
import { logDbError } from '../database/db-error.util';
import { DINOS } from '../agents/dinos/dinos';
import { updateElo, DEFAULT_RATING } from './elo';
import { ArenaVote, DinoRating, LeaderboardRow } from '@org/shared-types';

type DbConnection = { db: Database | null; pool: unknown };

/**
 * ArenaService — manages dino Elo ratings for the Arena mode.
 *
 * Degrades gracefully when DATABASE_URL is unset: getMatchup still works
 * (random dinos from the registry), recordVote no-ops, and getLeaderboard
 * returns all dinos at their DEFAULT_RATING with 0 games.
 */
@Injectable()
export class ArenaService {
  private readonly logger = new Logger(ArenaService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly connection: DbConnection,
  ) {}

  /**
   * Pick two distinct random dinos from the registry.
   * Always works — does not require a DB connection.
   */
  getMatchup(): { aDinoId: string; bDinoId: string } {
    const ids = DINOS.map((d) => d.id);
    if (ids.length < 2) {
      // Defensive: should never happen in practice with 4 dinos.
      return { aDinoId: ids[0], bDinoId: ids[0] };
    }
    const aIndex = Math.floor(Math.random() * ids.length);
    let bIndex: number;
    do {
      bIndex = Math.floor(Math.random() * ids.length);
    } while (bIndex === aIndex);
    return { aDinoId: ids[aIndex], bDinoId: ids[bIndex] };
  }

  /**
   * Record the result of an arena match: load or seed both ratings, apply
   * updateElo, increment counters, and upsert.
   *
   * No-ops when the DB is unavailable — the vote is silently discarded.
   */
  async recordVote(vote: ArenaVote): Promise<void> {
    const db = this.connection.db;
    if (!db) {
      this.logger.warn('recordVote: DB unavailable — vote not persisted');
      return;
    }

    try {
      // Load existing ratings (or use defaults).
      const [rowA, rowB] = await Promise.all([
        this.loadOrDefault(db, vote.aDinoId),
        this.loadOrDefault(db, vote.bDinoId),
      ]);

      // Apply Elo update.
      const updated = updateElo(rowA.rating, rowB.rating, vote.result);

      // Compute counter deltas.
      const aWon = vote.result === 'a';
      const bWon = vote.result === 'b';
      const isDraw = vote.result === 'draw';

      const newA: DinoRating = {
        dinoId: vote.aDinoId,
        rating: updated.ra,
        wins: rowA.wins + (aWon ? 1 : 0),
        losses: rowA.losses + (bWon ? 1 : 0),
        draws: rowA.draws + (isDraw ? 1 : 0),
        games: rowA.games + 1,
      };

      const newB: DinoRating = {
        dinoId: vote.bDinoId,
        rating: updated.rb,
        wins: rowB.wins + (bWon ? 1 : 0),
        losses: rowB.losses + (aWon ? 1 : 0),
        draws: rowB.draws + (isDraw ? 1 : 0),
        games: rowB.games + 1,
      };

      // Upsert both rows.
      await Promise.all([this.upsertRating(db, newA), this.upsertRating(db, newB)]);
    } catch (err) {
      logDbError(this.logger, 'recordVote', err);
      // Do not re-throw — a rating failure must never break the client flow.
    }
  }

  /**
   * Return all dinos ranked by rating descending.
   * Dinos with no rating row appear at DEFAULT_RATING / 0 games.
   * Falls back to registry defaults when DB is unavailable.
   */
  async getLeaderboard(): Promise<LeaderboardRow[]> {
    const db = this.connection.db;

    // Build a lookup of persisted ratings (empty map if DB is off).
    const persistedMap = new Map<string, DinoRating>();

    if (db) {
      try {
        const rows = await db.select().from(dinoRatings);
        for (const row of rows) {
          persistedMap.set(row.dinoId, {
            dinoId: row.dinoId,
            rating: row.rating,
            wins: row.wins,
            losses: row.losses,
            draws: row.draws,
            games: row.games,
          });
        }
      } catch (err) {
        logDbError(this.logger, 'getLeaderboard', err);
        // Fall through — use registry defaults for all dinos.
      }
    }

    // Merge registry with persisted ratings.
    const rows: LeaderboardRow[] = DINOS.map((dino) => {
      const persisted = persistedMap.get(dino.id);
      return {
        dinoId: dino.id,
        name: dino.name,
        species: dino.species,
        rating: persisted?.rating ?? DEFAULT_RATING,
        wins: persisted?.wins ?? 0,
        losses: persisted?.losses ?? 0,
        draws: persisted?.draws ?? 0,
        games: persisted?.games ?? 0,
      };
    });

    // Sort by rating descending, then by name for stable ties.
    rows.sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));

    return rows;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async loadOrDefault(db: Database, dinoId: string): Promise<DinoRating> {
    const rows = await db
      .select()
      .from(dinoRatings)
      .where(eq(dinoRatings.dinoId, dinoId))
      .limit(1);

    if (rows.length > 0) {
      const r = rows[0];
      return {
        dinoId: r.dinoId,
        rating: r.rating,
        wins: r.wins,
        losses: r.losses,
        draws: r.draws,
        games: r.games,
      };
    }

    return {
      dinoId,
      rating: DEFAULT_RATING,
      wins: 0,
      losses: 0,
      draws: 0,
      games: 0,
    };
  }

  private async upsertRating(db: Database, row: DinoRating): Promise<void> {
    await db
      .insert(dinoRatings)
      .values({
        dinoId: row.dinoId,
        rating: row.rating,
        wins: row.wins,
        losses: row.losses,
        draws: row.draws,
        games: row.games,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: dinoRatings.dinoId,
        set: {
          rating: row.rating,
          wins: row.wins,
          losses: row.losses,
          draws: row.draws,
          games: row.games,
          updatedAt: new Date(),
        },
      });
  }
}
