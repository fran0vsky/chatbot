import { createReducer, on } from '@ngrx/store';
import { ChatMessage, ConversationSession } from '@org/shared-types';
import * as SessionActions from './session.actions';
import {
  removeFromList,
  renameInList,
  togglePinInList,
  upsertInList,
} from './session-list.ops';

export const WELCOME_MESSAGE: ChatMessage = {
  text: 'Welcome to DinoAgents — the AI that survived. What can I help you with?',
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
    sessions: removeFromList(state.sessions, id),
  })),
  on(SessionActions.renameSession, (state, { id, title }) => ({
    ...state,
    sessions: renameInList(state.sessions, id, title),
  })),
  on(SessionActions.togglePin, (state, { id }) => ({
    ...state,
    sessions: togglePinInList(state.sessions, id),
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
