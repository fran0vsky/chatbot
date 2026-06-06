// Drizzle schema for DinoAgents persistence.
// Initial scope: conversation sessions + messages. Auth user table added later.

import { pgTable, text, timestamp, integer, jsonb, boolean, uuid, index } from 'drizzle-orm/pg-core';

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Future: foreign-key to users(id) once auth is wired
    userId: text('user_id'),
    title: text('title').notNull().default('Untitled'),
    pinned: boolean('pinned').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('sessions_user_idx').on(table.userId),
    updatedIdx: index('sessions_updated_idx').on(table.updatedAt),
  }),
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant', 'error', 'tool'] }).notNull(),
    text: text('text').notNull(),
    // Tool-call payload (jsonb so we can query by tool name later)
    toolName: text('tool_name'),
    toolArgs: jsonb('tool_args'),
    toolResult: text('tool_result'),
    // Reasoning / chain-of-thought stream
    reasoning: text('reasoning'),
    reasoningDurationMs: integer('reasoning_duration_ms'),
    // Ordering within a session
    sequence: integer('sequence').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: index('messages_session_idx').on(table.sessionId, table.sequence),
  }),
);

// Per-(user × dino) durable memory. Lets a dino recall facts a user shared in a
// different thread. Scoped strictly by (userId, dinoId) — a dino never sees
// another dino's memories. Identity is an anonymous per-device id (no auth yet).
export const userMemories = pgTable(
  'user_memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    dinoId: text('dino_id').notNull(),
    content: text('content').notNull(),
    // Provenance of the fact, e.g. 'extracted' (model-derived) | 'taught' (Phase 22).
    source: text('source'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userDinoIdx: index('user_memories_user_dino_idx').on(table.userId, table.dinoId),
  }),
);

// User-authored, titled skills taught to a dino. Same scoping as userMemories
// (per userId × dinoId) but distinct because skills are standing instructions
// the user deliberately authored, not facts the model auto-extracted.
export const dinoSkills = pgTable(
  'dino_skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    dinoId: text('dino_id').notNull(),
    title: text('title').notNull(),
    instruction: text('instruction').notNull(),
    whenToActivate: text('when_to_activate'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userDinoIdx: index('dino_skills_user_dino_idx').on(table.userId, table.dinoId),
  }),
);

// Per-dino Elo-style arena rating. One row per dinoId.
// Degrades gracefully: if the table does not exist (no DB), ArenaService
// falls back to registry defaults and no-ops on writes.
export const dinoRatings = pgTable('dino_ratings', {
  dinoId: text('dino_id').primaryKey(),
  rating: integer('rating').notNull().default(1000),
  wins: integer('wins').notNull().default(0),
  losses: integer('losses').notNull().default(0),
  draws: integer('draws').notNull().default(0),
  games: integer('games').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type UserMemory = typeof userMemories.$inferSelect;
export type NewUserMemory = typeof userMemories.$inferInsert;
export type DinoSkill = typeof dinoSkills.$inferSelect;
export type NewDinoSkill = typeof dinoSkills.$inferInsert;
export type DinoRatingRow = typeof dinoRatings.$inferSelect;
export type NewDinoRatingRow = typeof dinoRatings.$inferInsert;
