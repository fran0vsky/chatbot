import { createReducer, on } from '@ngrx/store';
import { ChatMessage, ConversationSession } from '@org/shared-types';
import * as SessionActions from './session.actions';

export const WELCOME_MESSAGE: ChatMessage = {
  text: 'Welcome to SpinoChat — the AI that survived. What can I help you with?',
  role: 'assistant',
  createdAt: 0,
};

export interface SessionState {
  sessions: ConversationSession[];
  activeSessionId?: string;
  messages: ChatMessage[];
}

export const initialSessionState: SessionState = {
  sessions: [],
  activeSessionId: undefined,
  messages: [{ ...WELCOME_MESSAGE, createdAt: Date.now() }],
};

/** Mirror of HistoryService.upsertSession's list logic (replace-or-prepend). */
function upsertInList(
  sessions: ConversationSession[],
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

export const sessionReducer = createReducer(
  initialSessionState,
  on(SessionActions.loadSessionsSuccess, (state, { sessions }) => ({
    ...state,
    sessions,
  })),
  on(SessionActions.newChat, (state, { sessionId, messages }) => ({
    ...state,
    activeSessionId: sessionId,
    messages,
  })),
  on(SessionActions.switchSession, (state, { session }) => ({
    ...state,
    activeSessionId: session.id,
    messages: session.messages,
  })),
  on(SessionActions.deleteSession, (state, { id }) => ({
    ...state,
    sessions: state.sessions.filter((s) => s.id !== id),
  })),
  on(SessionActions.renameSession, (state, { id, title }) => ({
    ...state,
    sessions: state.sessions.map((s) => (s.id === id ? { ...s, title } : s)),
  })),
  on(SessionActions.togglePin, (state, { id }) => ({
    ...state,
    sessions: state.sessions.map((s) =>
      s.id === id ? { ...s, pinned: !s.pinned } : s,
    ),
  })),
  on(SessionActions.appendMessage, (state, { message }) => ({
    ...state,
    messages: [...state.messages, message],
  })),
  on(SessionActions.setMessages, (state, { messages }) => ({
    ...state,
    messages,
  })),
  on(SessionActions.upsertActiveSession, (state, { session }) => ({
    ...state,
    sessions: upsertInList(state.sessions, session),
  })),
  on(SessionActions.setActiveSessionId, (state, { id }) => ({
    ...state,
    activeSessionId: id,
  })),
);
