import { createAction, props } from '@ngrx/store';
import { DinoSummary } from '@org/shared-types';

export const loadDinos = createAction('[Dino] Load Dinos');
export const loadDinosSuccess = createAction(
  '[Dino] Load Dinos Success',
  props<{ roster: DinoSummary[] }>(),
);
export const loadDinosFailure = createAction('[Dino] Load Dinos Failure');

export const setActiveDino = createAction(
  '[Dino] Set Active Dino',
  props<{ dinoId: string | undefined }>(),
);
