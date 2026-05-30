import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { map, tap, withLatestFrom } from 'rxjs/operators';
import * as UiActions from './ui.actions';
import { selectTheme } from './ui.selectors';

const THEME_KEY = 'desert-theme';

/** Apply the theme to <html> and persist it — moved out of ChatComponent.applyTheme. */
function applyTheme(theme: 'day' | 'night'): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // localStorage unavailable (private mode) — ignore persistence.
  }
  document.documentElement.classList.remove('day-mode', 'night-mode');
  document.documentElement.classList.add(
    theme === 'day' ? 'day-mode' : 'night-mode',
  );
}

/**
 * On init, re-emit the hydrated theme as a setTheme so the DOM class is applied
 * (the initial theme value already comes from localStorage in the reducer).
 */
export const hydrateThemeOnInit$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store)) =>
    actions$.pipe(
      ofType(UiActions.initUi),
      withLatestFrom(store.select(selectTheme)),
      map(([, theme]) => UiActions.setTheme({ theme })),
    ),
  { functional: true },
);

/**
 * Persist + apply theme whenever it changes (setTheme / toggleTheme).
 * Non-dispatching: the side effect is the DOM/localStorage write. Reads the
 * post-reducer theme from the store so toggleTheme resolves correctly.
 */
export const persistTheme$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store)) =>
    actions$.pipe(
      ofType(UiActions.setTheme, UiActions.toggleTheme),
      withLatestFrom(store.select(selectTheme)),
      tap(([, theme]) => applyTheme(theme)),
    ),
  { functional: true, dispatch: false },
);
