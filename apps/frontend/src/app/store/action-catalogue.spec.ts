// @angular/compiler is required so @ngrx/store's partially-compiled injectables
// can JIT-compile under the unit-test runner.
import '@angular/compiler';
import { Action, Store } from '@ngrx/store';
import {
  ACTION_CATALOGUE,
  APP_ACTION_NAMES,
  AppActionName,
  dispatchCatalogued,
} from './action-catalogue';

/** Minimal Store stub that records dispatched actions. */
function buildStore(): Store & { dispatched: Action[] } {
  const dispatched: Action[] = [];
  return {
    dispatched,
    dispatch: (action: Action) => dispatched.push(action),
  } as unknown as Store & { dispatched: Action[] };
}

/** Valid params for each catalogue entry (used to assert create() validity). */
const VALID_PARAMS: Record<AppActionName, unknown> = {
  change_theme: { theme: 'day' },
  new_chat: {},
  switch_chat: { sessionId: 's-1' },
  read_last_message: {},
  send_message: { text: 'hello' },
  set_active_view: { view: 'explore' },
  select_dino: { dinoId: 'rexford' },
};

describe('ACTION_CATALOGUE', () => {
  it('matches the documented whitelist of intent names', () => {
    expect(new Set(APP_ACTION_NAMES)).toEqual(
      new Set([
        'change_theme',
        'new_chat',
        'switch_chat',
        'read_last_message',
        'send_message',
        'set_active_view',
        'select_dino',
      ]),
    );
  });

  it('does NOT expose any destructive capability (AST-03)', () => {
    for (const forbidden of [
      'delete_account',
      'delete_session',
      'delete_chat',
      'drop_table',
    ]) {
      expect(Object.prototype.hasOwnProperty.call(ACTION_CATALOGUE, forbidden)).toBe(
        false,
      );
    }
  });

  it('every entry produces a valid Action with a string type from valid params', () => {
    for (const name of APP_ACTION_NAMES) {
      const def = ACTION_CATALOGUE[name];
      const parsed = def.params.safeParse(VALID_PARAMS[name]);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        const action = (def.create as (p: unknown) => Action)(parsed.data);
        expect(typeof action.type).toBe('string');
        expect(action.type.length).toBeGreaterThan(0);
      }
    }
  });

  describe('dispatchCatalogued', () => {
    it('validates + dispatches a known action with valid params', () => {
      const store = buildStore();
      const result = dispatchCatalogued(store, 'set_active_view', {
        view: 'arena',
      });
      expect(result.ok).toBe(true);
      expect(store.dispatched).toHaveLength(1);
      expect(store.dispatched[0].type).toBe('[UI] Set Active View');
    });

    it('rejects an unknown action name without dispatching', () => {
      const store = buildStore();
      const result = dispatchCatalogued(store, 'delete_account', {});
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('Unknown action');
      expect(store.dispatched).toHaveLength(0);
    });

    it('rejects invalid params without dispatching', () => {
      const store = buildStore();
      const result = dispatchCatalogued(store, 'set_active_view', {
        view: 'not-a-view',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('Invalid params');
      expect(store.dispatched).toHaveLength(0);
    });

    it('rejects missing required params without dispatching', () => {
      const store = buildStore();
      const result = dispatchCatalogued(store, 'select_dino', {});
      expect(result.ok).toBe(false);
      expect(store.dispatched).toHaveLength(0);
    });

    it('maps change_theme toggle to the toggle action', () => {
      const store = buildStore();
      const result = dispatchCatalogued(store, 'change_theme', {
        theme: 'toggle',
      });
      expect(result.ok).toBe(true);
      expect(store.dispatched[0].type).toBe('[UI] Toggle Theme');
    });
  });
});
