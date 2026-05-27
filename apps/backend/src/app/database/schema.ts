// Drizzle schema for SpinoChat persistence.
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

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
