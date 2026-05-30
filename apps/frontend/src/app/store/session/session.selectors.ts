import { createFeatureSelector, createSelector } from '@ngrx/store';
import { SESSION_FEATURE_KEY } from '../app.state';
import { SessionState } from './session.reducer';

export const selectSessionState =
  createFeatureSelector<SessionState>(SESSION_FEATURE_KEY);

export const selectSessions = createSelector(
  selectSessionState,
  (s) => s.sessions,
);
export const selectActiveSessionId = createSelector(
  selectSessionState,
  (s) => s.activeSessionId,
);
export const selectMessages = createSelector(
  selectSessionState,
  (s) => s.messages,
);
export const selectActiveSession = createSelector(
  selectSessions,
  selectActiveSessionId,
  (sessions, id) => (id ? sessions.find((s) => s.id === id) : undefined),
);

/** Used by the voice assistant's "read/listen last message" intent (Phase 29). */
export const selectLastAssistantMessage = createSelector(
  selectMessages,
  (messages) => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i];
    }
    return undefined;
  },
);
