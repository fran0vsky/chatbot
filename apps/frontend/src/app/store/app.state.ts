import { UiState } from './ui/ui.reducer';
import { DinoState } from './dino/dino.reducer';
import { SessionState } from './session/session.reducer';

/** Feature-key constants — the single source of truth for slice names. */
export const UI_FEATURE_KEY = 'ui';
export const DINO_FEATURE_KEY = 'dino';
export const SESSION_FEATURE_KEY = 'session';

/**
 * Root application state. Only the assistant-relevant, persistent slices live
 * here (ui / dino / session). Transient streaming state, knowledge files,
 * skill-panel state and arena/groupchat selection remain component signals —
 * see Phase 27 SUMMARY for the documented scope boundary.
 */
export interface AppState {
  [UI_FEATURE_KEY]: UiState;
  [DINO_FEATURE_KEY]: DinoState;
  [SESSION_FEATURE_KEY]: SessionState;
}
