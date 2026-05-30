import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { map, tap } from 'rxjs/operators';
import { HistoryService } from '../../chat/history.service';
import * as SessionActions from './session.actions';

/** On init, hydrate the sessions list from localStorage via HistoryService. */
export const loadSessionsOnInit$ = createEffect(
  (actions$ = inject(Actions), history = inject(HistoryService)) =>
    actions$.pipe(
      ofType(SessionActions.loadSessions),
      map(() =>
        SessionActions.loadSessionsSuccess({
          sessions: history.loadSessions(),
        }),
      ),
    ),
  { functional: true },
);

/**
 * Persist mutating session actions to localStorage via HistoryService.
 * Non-dispatching: the store is the in-memory source of truth, HistoryService
 * is the durable boundary (unchanged from the pre-refactor behavior).
 */
export const persistSessions$ = createEffect(
  (actions$ = inject(Actions), history = inject(HistoryService)) =>
    actions$.pipe(
      ofType(
        SessionActions.upsertActiveSession,
        SessionActions.deleteSession,
        SessionActions.renameSession,
        SessionActions.togglePin,
      ),
      tap((action) => {
        switch (action.type) {
          case SessionActions.upsertActiveSession.type:
            history.upsertSession(action.session);
            break;
          case SessionActions.deleteSession.type:
            history.deleteSession(action.id);
            break;
          case SessionActions.renameSession.type:
            history.updateTitle(action.id, action.title);
            break;
          case SessionActions.togglePin.type:
            history.togglePin(action.id);
            break;
        }
      }),
    ),
  { functional: true, dispatch: false },
);
