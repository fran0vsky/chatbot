import { createReducer, on } from '@ngrx/store';
import { ActiveView, Theme } from './ui.actions';
import * as UiActions from './ui.actions';

export interface UiState {
  theme: Theme;
  activeView: ActiveView;
  mobileSidebarOpen: boolean;
  historyOpen: boolean;
  pickerOpen: boolean;
}

/** Read the persisted theme; default 'night' to match the pre-refactor app. */
function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('desert-theme');
    return saved === 'day' ? 'day' : 'night';
  } catch {
    return 'night';
  }
}

export const initialUiState: UiState = {
  theme: initialTheme(),
  activeView: 'chats',
  mobileSidebarOpen: false,
  historyOpen: false,
  pickerOpen: false,
};

export const uiReducer = createReducer(
  initialUiState,
  on(UiActions.setTheme, (state, { theme }) => ({ ...state, theme })),
  on(UiActions.toggleTheme, (state) => ({
    ...state,
    theme: state.theme === 'day' ? ('night' as const) : ('day' as const),
  })),
  on(UiActions.setActiveView, (state, { view }) => ({
    ...state,
    activeView: view,
    mobileSidebarOpen: false,
  })),
  on(UiActions.toggleMobileSidebar, (state) => ({
    ...state,
    mobileSidebarOpen: !state.mobileSidebarOpen,
  })),
  on(UiActions.closeMobileSidebar, (state) => ({
    ...state,
    mobileSidebarOpen: false,
  })),
  on(UiActions.toggleHistory, (state) => ({
    ...state,
    historyOpen: !state.historyOpen,
  })),
  on(UiActions.closeHistory, (state) => ({ ...state, historyOpen: false })),
  on(UiActions.openPicker, (state) => ({ ...state, pickerOpen: true })),
  on(UiActions.closePicker, (state) => ({ ...state, pickerOpen: false })),
);
