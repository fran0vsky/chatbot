import { Action, Store } from '@ngrx/store';
import { z } from 'zod';
import * as DinoActions from './dino/dino.actions';
import * as SessionActions from './session/session.actions';
import * as UiActions from './ui/ui.actions';

/**
 * The action catalogue is the ONLY surface the voice "dino assistant" (Phase 29)
 * may dispatch through. It maps a stable intent name → a description, a zod
 * parameter schema, and a `create(params)` factory returning a real NgRx Action.
 *
 * Safety boundary (T-27-01 / AST-03): destructive or unsupported capabilities
 * (e.g. delete_account, delete_session) are simply ABSENT from this map, so the
 * assistant structurally "can't" perform them — there is no entry to dispatch.
 */

// send_message is intent-only: ChatComponent owns the streaming pipeline, so
// the catalogue emits a marker action the component (Phase 29) listens for.
const sendMessageAction = (text: string): Action & { text: string } => ({
  type: '[Assistant] Send Message Requested',
  text,
});

// read_last_message is a pure READ intent: the assistant resolves the message
// via selectLastAssistantMessage. The catalogue emits a no-op marker (no
// reducer handles it) so the intent never mutates UI state — dispatching a
// real navigation action here would be an observable side effect (WR-02).
const readLastMessageAction = (): Action => ({
  type: '[Assistant] Read Last Message Requested',
});

const changeThemeSchema = z.object({
  theme: z.enum(['day', 'night', 'toggle']),
});
const newChatSchema = z.object({}).strict();
const switchChatSchema = z.object({ sessionId: z.string().min(1) });
const readLastMessageSchema = z.object({}).strict();
const sendMessageSchema = z.object({ text: z.string().min(1) });
const setActiveViewSchema = z.object({
  view: z.enum([
    'chats',
    'explore',
    'knowledge',
    'groupchat',
    'arena',
    'leaderboard',
  ]),
});
const selectDinoSchema = z.object({ dinoId: z.string().min(1) });

interface CatalogueEntry<S extends z.ZodTypeAny> {
  description: string;
  params: S;
  create: (params: z.infer<S>) => Action;
}

function entry<S extends z.ZodTypeAny>(e: CatalogueEntry<S>): CatalogueEntry<S> {
  return e;
}

export const ACTION_CATALOGUE = {
  change_theme: entry({
    description: 'Switch the colour theme to day or night, or toggle it.',
    params: changeThemeSchema,
    create: ({ theme }) =>
      theme === 'toggle'
        ? UiActions.toggleTheme()
        : UiActions.setTheme({ theme }),
  }),
  new_chat: entry({
    description: 'Open the dino picker to start a new chat.',
    params: newChatSchema,
    create: () => UiActions.openPicker(),
  }),
  switch_chat: entry({
    description: 'Switch the active session id to an existing conversation.',
    params: switchChatSchema,
    create: ({ sessionId }) =>
      SessionActions.setActiveSessionId({ id: sessionId }),
  }),
  read_last_message: entry({
    description:
      'Resolve the last assistant message (handled by the assistant via selectLastAssistantMessage); dispatches a no-op marker.',
    params: readLastMessageSchema,
    create: () => readLastMessageAction(),
  }),
  send_message: entry({
    description: 'Send a chat message on the user behalf.',
    params: sendMessageSchema,
    create: ({ text }) => sendMessageAction(text),
  }),
  set_active_view: entry({
    description:
      'Navigate to a top-level view (chats, explore, knowledge, groupchat, arena, leaderboard).',
    params: setActiveViewSchema,
    create: ({ view }) => UiActions.setActiveView({ view }),
  }),
  select_dino: entry({
    description: 'Set the active dino by id.',
    params: selectDinoSchema,
    create: ({ dinoId }) => DinoActions.setActiveDino({ dinoId }),
  }),
} as const;

export type AppActionName = keyof typeof ACTION_CATALOGUE;

/** The documented whitelist of intent names (single source of truth for tests). */
export const APP_ACTION_NAMES = Object.keys(ACTION_CATALOGUE) as AppActionName[];

export type DispatchResult =
  | { ok: true; action: Action }
  | { ok: false; error: string };

/**
 * The safety gate: validates `params` against the named entry's zod schema,
 * then dispatches the resulting action. Unknown names and invalid params are
 * rejected (never dispatched). Phase 29 dispatches ONLY through here.
 */
export function dispatchCatalogued(
  store: Store,
  name: string,
  params: unknown,
): DispatchResult {
  if (!Object.prototype.hasOwnProperty.call(ACTION_CATALOGUE, name)) {
    return { ok: false, error: `Unknown action: ${name}` };
  }
  const def = ACTION_CATALOGUE[name as AppActionName];
  const parsed = def.params.safeParse(params);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Invalid params for ${name}: ${parsed.error.message}`,
    };
  }
  // parsed.data is validated to match the entry's schema.
  const action = (def.create as (p: unknown) => Action)(parsed.data);
  store.dispatch(action);
  return { ok: true, action };
}
