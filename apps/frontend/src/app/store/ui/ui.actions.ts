import { createAction, props } from '@ngrx/store';

export type Theme = 'day' | 'night';
export type ActiveView =
  | 'chats'
  | 'knowledge'
  | 'groupchat'
  | 'arena'
  | 'leaderboard';

/** Fired once on app init to hydrate theme from localStorage. */
export const initUi = createAction('[UI] Init');

export const setTheme = createAction(
  '[UI] Set Theme',
  props<{ theme: Theme }>(),
);
export const toggleTheme = createAction('[UI] Toggle Theme');

export const setActiveView = createAction(
  '[UI] Set Active View',
  props<{ view: ActiveView }>(),
);

export const toggleMobileSidebar = createAction('[UI] Toggle Mobile Sidebar');
export const closeMobileSidebar = createAction('[UI] Close Mobile Sidebar');

export const toggleHistory = createAction('[UI] Toggle History');
export const closeHistory = createAction('[UI] Close History');

export const openPicker = createAction('[UI] Open Picker');
export const closePicker = createAction('[UI] Close Picker');
