import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { CreateCustomDinoRequest, CustomDino, UpdateCustomDinoRequest } from '@org/shared-types';
import { DATABASE_CONNECTION, Database } from '../database/database.module';
import { customDinos, CustomDinoRow } from '../database/schema';
import { isAllowedModel } from './model-catalogue';

type DbConnection = { db: Database | null; pool: unknown };

/** Allowed tool names — must match tools/index.ts exactly. */
const ALLOWED_TOOLS = new Set<string>(['get_current_time', 'web_search', 'fetch_page']);

/**
 * ID prefix used to distinguish user-authored dinos from built-in registry ids.
 * The prefix is applied when returning rows to callers and stripped on lookups.
 * Documented here as the single source of truth for the mapping (D-02).
 */
const CUSTOM_ID_PREFIX = 'custom:';

/**
 * CRUD service for user-authored custom dinos.
 *
 * Every public method:
 *   - guards against a null DB connection (graceful degradation, mirrors MemoryService)
 *   - guards against a missing userId
 *   - wraps DB operations in try/catch that logs via Logger and returns a safe empty
 *     value ([], null) for infrastructure errors — NEVER throws for infra failures
 *   - validation failures DO throw BadRequestException so the HTTP layer gets a 400
 *
 * The `custom:` id prefix lets the resolver branch cheaply:
 *   id.startsWith('custom:') → DB lookup via CustomDinoService
 *   else                     → getDino() from the built-in registry
 */
@Injectable()
export class CustomDinoService {
  private readonly logger = new Logger(CustomDinoService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly connection: DbConnection,
  ) {}

  // ---------------------------------------------------------------------------
  // Public CRUD
  // ---------------------------------------------------------------------------

  /** Create a new custom dino scoped to `req.userId`. Returns the created row with
   *  the public `custom:` id. Returns null when DB is unavailable. */
  async create(req: CreateCustomDinoRequest): Promise<CustomDino | null> {
    const db = this.connection.db;
    if (!db || !req.userId) return null;

    this.validate(req.name, req.systemPrompt, req.model, req.toolNames ?? []);

    try {
      const [row] = await db
        .insert(customDinos)
        .values({
          userId: req.userId,
          name: req.name.trim(),
          species: req.species?.trim() ?? null,
          avatarUrl: req.avatarUrl?.trim() ?? null,
          blurb: req.blurb?.trim() ?? null,
          persona: req.persona?.trim() ?? null,
          systemPrompt: req.systemPrompt.trim(),
          model: req.model,
          toolNames: req.toolNames ?? [],
          accent: req.accent?.trim() ?? null,
        })
        .returning();
      return row ? this.toPublicShape(row) : null;
    } catch (err) {
      this.logger.error(`create failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  /** List all custom dinos for `userId`, newest first. Returns [] when DB is off or userId missing. */
  async list(userId: string | undefined): Promise<CustomDino[]> {
    const db = this.connection.db;
    if (!db || !userId) return [];
    try {
      const rows = await db
        .select()
        .from(customDinos)
        .where(eq(customDinos.userId, userId))
        .orderBy(desc(customDinos.createdAt));
      return rows.map((r) => this.toPublicShape(r));
    } catch (err) {
      this.logger.error(`list failed: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  /** Get a single custom dino by its public id (`custom:<uuid>`), scoped by userId.
   *  Returns null when DB is off, userId missing, or not found. */
  async getById(publicId: string, userId: string | undefined): Promise<CustomDino | null> {
    const db = this.connection.db;
    if (!db || !userId || !publicId) return null;
    const uuid = this.stripPrefix(publicId);
    if (!uuid) return null;
    try {
      const [row] = await db
        .select()
        .from(customDinos)
        .where(and(eq(customDinos.id, uuid), eq(customDinos.userId, userId)));
      return row ? this.toPublicShape(row) : null;
    } catch (err) {
      this.logger.error(`getById failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  /** Update an existing custom dino. Validates provided fields. Returns null when DB is off
   *  or userId missing. Returns the updated row. */
  async update(
    publicId: string,
    userId: string | undefined,
    req: UpdateCustomDinoRequest,
  ): Promise<CustomDino | null> {
    const db = this.connection.db;
    if (!db || !userId || !publicId) return null;
    const uuid = this.stripPrefix(publicId);
    if (!uuid) return null;

    // Partial validation: only validate fields the caller is changing
    const nameTrimmed = req.name?.trim();
    const systemPromptTrimmed = req.systemPrompt?.trim();
    if (req.name !== undefined && !nameTrimmed) {
      throw new BadRequestException('name must not be empty');
    }
    if (req.systemPrompt !== undefined && !systemPromptTrimmed) {
      throw new BadRequestException('systemPrompt must not be empty');
    }
    if (req.model !== undefined && !isAllowedModel(req.model)) {
      throw new BadRequestException(`model '${req.model}' is not in the curated model catalogue`);
    }
    if (req.toolNames !== undefined) {
      this.validateToolNames(req.toolNames);
    }

    try {
      const [row] = await db
        .update(customDinos)
        .set({
          ...(nameTrimmed !== undefined ? { name: nameTrimmed } : {}),
          ...(req.species !== undefined ? { species: req.species.trim() || null } : {}),
          ...(req.avatarUrl !== undefined ? { avatarUrl: req.avatarUrl.trim() || null } : {}),
          ...(req.blurb !== undefined ? { blurb: req.blurb.trim() || null } : {}),
          ...(req.persona !== undefined ? { persona: req.persona.trim() || null } : {}),
          ...(systemPromptTrimmed !== undefined ? { systemPrompt: systemPromptTrimmed } : {}),
          ...(req.model !== undefined ? { model: req.model } : {}),
          ...(req.toolNames !== undefined ? { toolNames: req.toolNames } : {}),
          ...(req.accent !== undefined ? { accent: req.accent.trim() || null } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(customDinos.id, uuid), eq(customDinos.userId, userId)))
        .returning();
      return row ? this.toPublicShape(row) : null;
    } catch (err) {
      this.logger.error(`update failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  /** Delete a custom dino by its public id, scoped by userId. No-op when DB off or userId missing. */
  async delete(publicId: string, userId: string | undefined): Promise<void> {
    const db = this.connection.db;
    if (!db || !userId || !publicId) return;
    const uuid = this.stripPrefix(publicId);
    if (!uuid) return;
    try {
      await db
        .delete(customDinos)
        .where(and(eq(customDinos.id, uuid), eq(customDinos.userId, userId)));
    } catch (err) {
      this.logger.error(`delete failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Projection — public summary (no systemPrompt)
  // ---------------------------------------------------------------------------

  /**
   * Project a DB row to a DinoSummary-compatible object suitable for the dino picker.
   * Uses an explicit allowlist so `systemPrompt` can NEVER leak, even if new fields
   * are added to the table in the future (mirrors toDinoSummary() from dinos.ts — D-05).
   */
  toCustomDinoSummary(row: CustomDinoRow): {
    id: string;
    name: string;
    species: string;
    persona: string;
    blurb: string;
    specialty: string;
    model: string;
    toolNames: string[];
    accent: string | undefined;
    avatarUrl: string | undefined;
  } {
    return {
      id: this.toPublicId(row.id),
      name: row.name,
      species: row.species ?? '',
      persona: row.persona ?? '',
      blurb: row.blurb ?? '',
      specialty: 'Custom dino',
      model: row.model,
      toolNames: Array.isArray(row.toolNames) ? (row.toolNames as string[]) : [],
      accent: row.accent ?? undefined,
      avatarUrl: row.avatarUrl ?? undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Validate required create fields + model and tool catalogues. */
  private validate(name: string, systemPrompt: string, model: string, toolNames: string[]): void {
    if (!name?.trim()) {
      throw new BadRequestException('name is required');
    }
    if (!systemPrompt?.trim()) {
      throw new BadRequestException('systemPrompt is required');
    }
    if (!isAllowedModel(model)) {
      throw new BadRequestException(`model '${model}' is not in the curated model catalogue`);
    }
    this.validateToolNames(toolNames);
  }

  private validateToolNames(toolNames: string[]): void {
    for (const tool of toolNames) {
      if (!ALLOWED_TOOLS.has(tool)) {
        throw new BadRequestException(`toolName '${tool}' is not in the allowed tool catalogue`);
      }
    }
  }

  /** Convert a DB row to the public CustomDino shape with the `custom:` id prefix. */
  private toPublicShape(row: CustomDinoRow): CustomDino {
    return {
      id: this.toPublicId(row.id),
      userId: row.userId,
      name: row.name,
      species: row.species ?? undefined,
      avatarUrl: row.avatarUrl ?? undefined,
      blurb: row.blurb ?? undefined,
      persona: row.persona ?? undefined,
      systemPrompt: row.systemPrompt,
      model: row.model,
      toolNames: Array.isArray(row.toolNames) ? (row.toolNames as string[]) : [],
      accent: row.accent ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Add the `custom:` prefix to a raw DB uuid. */
  private toPublicId(uuid: string): string {
    return `${CUSTOM_ID_PREFIX}${uuid}`;
  }

  /**
   * Strip the `custom:` prefix and return the raw uuid, or null when the prefix is absent.
   * The null return lets callers treat a missing prefix as "not found" rather than throwing.
   */
  private stripPrefix(publicId: string): string | null {
    if (!publicId.startsWith(CUSTOM_ID_PREFIX)) return null;
    return publicId.slice(CUSTOM_ID_PREFIX.length);
  }
}
