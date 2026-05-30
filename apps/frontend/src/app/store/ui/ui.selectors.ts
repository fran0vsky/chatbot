import { createFeatureSelector, createSelector } from '@ngrx/store';
import { UI_FEATURE_KEY } from '../app.state';
import { UiState } from './ui.reducer';

export const selectUiState = createFeatureSelector<UiState>(UI_FEATURE_KEY);

export const selectTheme = createSelector(selectUiState, (s) => s.theme);
export const selectIsDayMode = createSelector(
  selectUiState,
  (s) => s.theme === 'day',
);
export const selectActiveView = createSelector(
  selectUiState,
  (s) => s.activeView,
);
export const selectMobileSidebarOpen = createSelector(
  selectUiState,
  (s) => s.mobileSidebarOpen,
);
export const selectHistoryOpen = createSelector(
  selectUiState,
  (s) => s.historyOpen,
);
export const selectPickerOpen = createSelector(
  selectUiState,
  (s) => s.pickerOpen,
);
