import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../database/database.module';
import { dinoSkills, userMemories, UserMemory } from '../database/schema';
import { logDbError } from '../database/db-error.util';

type DbConnection = { db: Database | null; pool: unknown };

/** A user-authored skill in the shape callers/UI care about (no scoping columns). */
export interface SkillView {
  id: string;
  title: string;
  instruction: string;
  /** Optional activation trigger. Empty/absent = always apply (CMP-05). */
  whenToActivate?: string | null;
}

const DEFAULT_LIMIT = 20;

/**
 * Persistent, per-(user × dino) memory. Lets a dino recall facts the user shared
 * in a different thread. Every method degrades gracefully when the DB is disabled
 * (`db` is null, e.g. local/e2e without DATABASE_URL) and never throws into callers
 * — a memory failure must never break the chat.
 */
@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly connection: DbConnection,
  ) {}

  /** Recent memory contents for (userId, dinoId), newest first. [] when DB off or userId missing. */
  async getMemories(userId: string | undefined, dinoId: string, limit = DEFAULT_LIMIT): Promise<string[]> {
    const db = this.connection.db;
    if (!db || !userId || !dinoId) return [];
    try {
      const rows = await db
        .select({ content: userMemories.content })
        .from(userMemories)
        .where(and(eq(userMemories.userId, userId), eq(userMemories.dinoId, dinoId)))
        .orderBy(desc(userMemories.createdAt))
        .limit(limit);
      return rows.map((r) => r.content);
    } catch (err) {
      logDbError(this.logger, 'getMemories', err);
      return [];
    }
  }

  /** Insert new facts for (userId, dinoId). No-op when DB off, userId missing, or empty. De-dupes identical content. */
  async writeMemories(
    userId: string | undefined,
    dinoId: string,
    contents: string[],
    source = 'extracted',
  ): Promise<void> {
    const db = this.connection.db;
    if (!db || !userId || !dinoId) return;
    const cleaned = contents.map((c) => c.trim()).filter((c) => c.length > 0);
    if (cleaned.length === 0) return;
    try {
      const existing = await db
        .select({ content: userMemories.content })
        .from(userMemories)
        .where(and(eq(userMemories.userId, userId), eq(userMemories.dinoId, dinoId)));
      const known = new Set(existing.map((r) => r.content));
      const fresh = [...new Set(cleaned)].filter((c) => !known.has(c));
      if (fresh.length === 0) return;
      await db.insert(userMemories).values(fresh.map((content) => ({ userId, dinoId, content, source })));
    } catch (err) {
      logDbError(this.logger, 'writeMemories', err);
    }
  }

  /** Full memory rows for a (userId, dinoId) — for the management UI (Phase 22 / MEM-06). */
  async listMemories(userId: string | undefined, dinoId: string): Promise<UserMemory[]> {
    const db = this.connection.db;
    if (!db || !userId || !dinoId) return [];
    try {
      return await db
        .select()
        .from(userMemories)
        .where(and(eq(userMemories.userId, userId), eq(userMemories.dinoId, dinoId)))
        .orderBy(desc(userMemories.createdAt));
    } catch (err) {
      logDbError(this.logger, 'listMemories', err);
      return [];
    }
  }

  /** Delete a single memory by id. No-op when DB off. */
  async deleteMemory(id: string): Promise<void> {
    const db = this.connection.db;
    if (!db || !id) return;
    try {
      await db.delete(userMemories).where(eq(userMemories.id, id));
    } catch (err) {
      logDbError(this.logger, 'deleteMemory', err);
    }
  }

  // --- User-authored skills (Phase 22) — same (userId × dinoId) scoping ---

  /** Skills taught for (userId, dinoId), newest first. [] when DB off or userId missing. */
  async getSkills(userId: string | undefined, dinoId: string): Promise<SkillView[]> {
    const db = this.connection.db;
    if (!db || !userId || !dinoId) return [];
    try {
      return await db
        .select({
          id: dinoSkills.id,
          title: dinoSkills.title,
          instruction: dinoSkills.instruction,
          whenToActivate: dinoSkills.whenToActivate,
        })
        .from(dinoSkills)
        .where(and(eq(dinoSkills.userId, userId), eq(dinoSkills.dinoId, dinoId)))
        .orderBy(desc(dinoSkills.createdAt));
    } catch (err) {
      logDbError(this.logger, 'getSkills', err);
      return [];
    }
  }

  /** Persist a taught skill. Returns the created skill, or null when DB off / invalid input. */
  async addSkill(
    userId: string | undefined,
    dinoId: string,
    title: string,
    instruction: string,
    whenToActivate?: string,
  ): Promise<SkillView | null> {
    const db = this.connection.db;
    const cleanTitle = title?.trim();
    const cleanInstruction = instruction?.trim();
    if (!db || !userId || !dinoId || !cleanTitle || !cleanInstruction) return null;
    const cleanTrigger = whenToActivate?.trim() || null;
    try {
      const [row] = await db
        .insert(dinoSkills)
        .values({ userId, dinoId, title: cleanTitle, instruction: cleanInstruction, whenToActivate: cleanTrigger })
        .returning({
          id: dinoSkills.id,
          title: dinoSkills.title,
          instruction: dinoSkills.instruction,
          whenToActivate: dinoSkills.whenToActivate,
        });
      return row ?? null;
    } catch (err) {
      logDbError(this.logger, 'addSkill', err);
      return null;
    }
  }

  /** Update a skill's title / trigger / instruction by id. Returns the updated skill, or null when DB off / id missing / invalid input. */
  async updateSkill(
    id: string,
    fields: { title?: string; whenToActivate?: string; instruction?: string },
  ): Promise<SkillView | null> {
    const db = this.connection.db;
    if (!db || !id) return null;
    const cleanTitle = fields.title?.trim();
    const cleanInstruction = fields.instruction?.trim();
    if (!cleanTitle || !cleanInstruction) return null;
    const cleanTrigger = fields.whenToActivate?.trim() || null;
    try {
      const [row] = await db
        .update(dinoSkills)
        .set({ title: cleanTitle, instruction: cleanInstruction, whenToActivate: cleanTrigger })
        .where(eq(dinoSkills.id, id))
        .returning({
          id: dinoSkills.id,
          title: dinoSkills.title,
          instruction: dinoSkills.instruction,
          whenToActivate: dinoSkills.whenToActivate,
        });
      return row ?? null;
    } catch (err) {
      logDbError(this.logger, 'updateSkill', err);
      return null;
    }
  }

  /** Delete a single skill by id. No-op when DB off. */
  async deleteSkill(id: string): Promise<void> {
    const db = this.connection.db;
    if (!db || !id) return;
    try {
      await db.delete(dinoSkills).where(eq(dinoSkills.id, id));
    } catch (err) {
      logDbError(this.logger, 'deleteSkill', err);
    }
  }
}
