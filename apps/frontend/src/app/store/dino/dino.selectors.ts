import { createFeatureSelector, createSelector } from '@ngrx/store';
import { DINO_FEATURE_KEY } from '../app.state';
import { DinoState } from './dino.reducer';

export const selectDinoState = createFeatureSelector<DinoState>(DINO_FEATURE_KEY);

export const selectRoster = createSelector(selectDinoState, (s) => s.roster);
export const selectDinosLoaded = createSelector(
  selectDinoState,
  (s) => s.loaded,
);
export const selectActiveDinoId = createSelector(
  selectDinoState,
  (s) => s.activeDinoId,
);
export const selectActiveDino = createSelector(
  selectRoster,
  selectActiveDinoId,
  (roster, id) => (id ? roster.find((d) => d.id === id) : undefined),
);
