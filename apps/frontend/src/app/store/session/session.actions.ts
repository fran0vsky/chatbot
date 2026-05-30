import { createAction, props } from '@ngrx/store';
import { ChatMessage, ConversationSession } from '@org/shared-types';

/** Fired on init to hydrate the sessions list from HistoryService. */
export const loadSessions = createAction('[Session] Load Sessions');
export const loadSessionsSuccess = createAction(
  '[Session] Load Sessions Success',
  props<{ sessions: ConversationSession[] }>(),
);

/**
 * Start a fresh chat. `sessionId` is the new thread id (minted from
 * ChatService), `messages` the welcome seed. activeSessionId tracks the
 * ChatService thread id (see scope boundary note).
 */
export const newChat = createAction(
  '[Session] New Chat',
  props<{ sessionId: string; messages: ChatMessage[] }>(),
);

/** Switch to an existing session (its messages become the active list). */
export const switchSession = createAction(
  '[Session] Switch Session',
  props<{ session: ConversationSession }>(),
);

export const deleteSession = createAction(
  '[Session] Delete Session',
  props<{ id: string }>(),
);
export const renameSession = createAction(
  '[Session] Rename Session',
  props<{ id: string; title: string }>(),
);
export const togglePin = createAction(
  '[Session] Toggle Pin',
  props<{ id: string }>(),
);

/** Append a single message to the active message list. */
export const appendMessage = createAction(
  '[Session] Append Message',
  props<{ message: ChatMessage }>(),
);

/** Replace the active message list wholesale (regenerate / edit-and-resend / stop). */
export const setMessages = createAction(
  '[Session] Set Messages',
  props<{ messages: ChatMessage[] }>(),
);

/**
 * Persist the current active session (id + title + messages + createdAt + dino)
 * into the sessions list via HistoryService. Mirrors saveCurrentSession /
 * finishRequest upserts.
 */
export const upsertActiveSession = createAction(
  '[Session] Upsert Active Session',
  props<{ session: ConversationSession }>(),
);

/** Keep activeSessionId consistent with the ChatService thread id. */
export const setActiveSessionId = createAction(
  '[Session] Set Active Session Id',
  props<{ id: string }>(),
);
