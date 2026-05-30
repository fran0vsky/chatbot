import { hydrateThemeOnInit$, persistTheme$ } from './ui/ui.effects';
import { loadDinos$ } from './dino/dino.effects';
import {
  loadSessionsOnInit$,
  persistSessions$,
} from './session/session.effects';

/** All app effects, registered via provideEffects in app.config.ts. */
export const appEffects = {
  hydrateThemeOnInit$,
  persistTheme$,
  loadDinos$,
  loadSessionsOnInit$,
  persistSessions$,
};
