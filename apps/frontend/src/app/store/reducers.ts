import { ActionReducerMap } from '@ngrx/store';
import { AppState, DINO_FEATURE_KEY, SESSION_FEATURE_KEY, UI_FEATURE_KEY } from './app.state';
import { uiReducer } from './ui/ui.reducer';
import { dinoReducer } from './dino/dino.reducer';
import { sessionReducer } from './session/session.reducer';

export const reducers: ActionReducerMap<AppState> = {
  [UI_FEATURE_KEY]: uiReducer,
  [DINO_FEATURE_KEY]: dinoReducer,
  [SESSION_FEATURE_KEY]: sessionReducer,
};
