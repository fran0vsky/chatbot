import { ConversationSession } from '@org/shared-types';

/**
 * Pure session-list transforms shared by BOTH the session reducer (in-memory
 * store) and HistoryService (localStorage persistence). Keeping a single
 * implementation guarantees the store list and the persisted list can never
 * drift apart (WR-01). All functions are non-mutating and return a new array.
 */

/** Replace-merge an existing session by id, or prepend it if new. */
export function upsertInList(
  sessions: readonly ConversationSession[],
  session: ConversationSession,
): ConversationSession[] {
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    const next = sessions.slice();
    next[idx] = { ...next[idx], ...session };
    return next;
  }
  return [session, ...sessions];
}

/** Remove a session by id. */
export function removeFromList(
  sessions: readonly ConversationSession[],
  id: string,
): ConversationSession[] {
  return sessions.filter((s) => s.id !== id);
}

/** Rename a session by id (no-op if absent). */
export function renameInList(
  sessions: readonly ConversationSession[],
  id: string,
  title: string,
): ConversationSession[] {
  return sessions.map((s) => (s.id === id ? { ...s, title } : s));
}

/** Toggle the pinned flag on a session by id (no-op if absent). */
export function togglePinInList(
  sessions: readonly ConversationSession[],
  id: string,
): ConversationSession[] {
  return sessions.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s));
}
