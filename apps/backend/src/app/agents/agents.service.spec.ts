import { describe, it, expect } from 'vitest';
import { resolveActiveTools } from './agents.service';
import { tools } from './tools';
import { getDino } from './dinos';

const ALL = tools.map((t) => t.name);

describe('resolveActiveTools', () => {
  it('returns all tools when no dino and no client filter', () => {
    expect(resolveActiveTools(ALL, undefined, undefined).sort()).toEqual(
      [...ALL].sort(),
    );
  });

  it('returns no tools when the client explicitly enables an empty set', () => {
    expect(resolveActiveTools(ALL, undefined, [])).toEqual([]);
  });

  it("narrows to a dino's tool subset", () => {
    const veloce = getDino('veloce'); // toolNames: ['fetch_page']
    expect(resolveActiveTools(ALL, veloce.toolNames, undefined)).toEqual([
      'fetch_page',
    ]);
  });

  it('intersects dino tools with a client filter (never widens beyond the dino)', () => {
    const veloce = getDino('veloce'); // only fetch_page
    // Client tries to also enable web_search — it must not be granted.
    const result = resolveActiveTools(ALL, veloce.toolNames, [
      'fetch_page',
      'web_search',
    ]);
    expect(result).toEqual(['fetch_page']);
  });

  it('lets the client narrow within a dino set', () => {
    const rexford = getDino('rexford'); // all three tools
    const result = resolveActiveTools(ALL, rexford.toolNames, [
      'get_current_time',
    ]);
    expect(result).toEqual(['get_current_time']);
  });

  it('never returns a tool name outside the provided universe', () => {
    const result = resolveActiveTools(ALL, ['nonexistent_tool'], undefined);
    expect(result).toEqual([]);
  });
});
