import { createReducer, on } from '@ngrx/store';
import { DinoSummary } from '@org/shared-types';
import * as DinoActions from './dino.actions';

export interface DinoState {
  roster: DinoSummary[];
  loaded: boolean;
  activeDinoId?: string;
}

export const initialDinoState: DinoState = {
  roster: [],
  loaded: false,
  activeDinoId: undefined,
};

export const dinoReducer = createReducer(
  initialDinoState,
  on(DinoActions.loadDinosSuccess, (state, { roster }) => ({
    ...state,
    roster,
    loaded: true,
  })),
  on(DinoActions.loadDinosFailure, (state) => ({
    ...state,
    roster: [],
    loaded: true,
  })),
  on(DinoActions.setActiveDino, (state, { dinoId }) => ({
    ...state,
    activeDinoId: dinoId,
  })),
);
