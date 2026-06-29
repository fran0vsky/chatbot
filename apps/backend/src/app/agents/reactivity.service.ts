import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DinoReactivityMap, REACTION_LEVELS, ReactionLevel } from '@org/shared-types';
import { DATABASE_CONNECTION, Database } from '../database/database.module';
import { dinoReactivity } from '../database/schema';
import { logDbError } from '../database/db-error.util';

type DbConnection = { db: Database | null; pool: unknown };

/**
 * Per-(userId × dinoId) when-to-react level persistence.
 *
 * Mirrors MemoryService: null-db guards, try/catch that logs and returns safe
 * defaults, never throwing into callers. A reactivity failure MUST NOT break
 * the group chat — the engine degrades to 'normal' for every dino when db is
 * unavailable (graceful degradation, T-43-01-03).
 */
@Injectable()
export class ReactivityService {
  private readonly logger = new Logger(ReactivityService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly connection: DbConnection,
  ) {}

  /**
   * Returns a map of dinoId → ReactionLevel for all rows stored for this user.
   * A dino with no stored row is absent from the map; the engine defaults it to
   * 'normal'. Returns {} when DB is disabled or userId is empty — never throws.
   */
  async getLevels(userId: string): Promise<DinoReactivityMap> {
    const db = this.connection.db;
    if (!db || !userId) return {};
    try {
      const rows = await db
        .select({ dinoId: dinoReactivity.dinoId, level: dinoReactivity.level })
        .from(dinoReactivity)
        .where(eq(dinoReactivity.userId, userId));
      return rows.reduce<DinoReactivityMap>((acc, row) => {
        acc[row.dinoId] = row.level as ReactionLevel;
        return acc;
      }, {});
    } catch (err) {
      logDbError(this.logger, 'getLevels', err);
      return {};
    }
  }

  /**
   * Upsert the ReactionLevel for a specific (userId, dinoId) pair.
   * Validates that `level ∈ REACTION_LEVELS`; throws BadRequestException on
   * an unknown value. No-ops (returning the requested pair) when DB is disabled
   * or userId/dinoId are empty — never throws on infra errors.
   */
  async setLevel(
    userId: string,
    dinoId: string,
    level: ReactionLevel,
  ): Promise<{ dinoId: string; level: ReactionLevel }> {
    // Validate the level enum first — this is an input-validation error, not
    // an infra error, so BadRequestException is the right response (T-43-01-02).
    if (!(REACTION_LEVELS as readonly string[]).includes(level)) {
      throw new BadRequestException(
        `Invalid level "${level}". Must be one of: ${REACTION_LEVELS.join(', ')}.`,
      );
    }

    const db = this.connection.db;
    // Null-db / empty-userId no-op: return the requested pair without touching DB.
    if (!db || !userId || !dinoId) {
      return { dinoId, level };
    }

    try {
      await db
        .insert(dinoReactivity)
        .values({ userId, dinoId, level })
        .onConflictDoUpdate({
          target: [dinoReactivity.userId, dinoReactivity.dinoId],
          set: {
            level,
            updatedAt: new Date(),
          },
        });
    } catch (err) {
      logDbError(this.logger, 'setLevel', err);
      // Degrade silently — the caller still gets a usable response (T-43-01-03).
    }

    return { dinoId, level };
  }
}
