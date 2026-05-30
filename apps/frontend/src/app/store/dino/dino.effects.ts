import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { DinoService } from '../../chat/dino.service';
import * as DinoActions from './dino.actions';

/**
 * loadDinos → DinoService HTTP → success/failure. Mirrors the graceful
 * degradation of the old DinoService.loadDinos (empty roster on error).
 */
export const loadDinos$ = createEffect(
  (actions$ = inject(Actions), dinoService = inject(DinoService)) =>
    actions$.pipe(
      ofType(DinoActions.loadDinos),
      switchMap(() =>
        dinoService.fetchDinos().pipe(
          map((roster) => DinoActions.loadDinosSuccess({ roster })),
          catchError(() => of(DinoActions.loadDinosFailure())),
        ),
      ),
    ),
  { functional: true },
);
