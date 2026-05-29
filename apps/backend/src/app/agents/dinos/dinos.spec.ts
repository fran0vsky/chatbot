import { describe, it, expect } from 'vitest';
import { tools } from '../tools';
import { DINOS, DEFAULT_DINO_ID, getDino, toDinoSummary } from './dinos';

const toolNames = new Set(tools.map((t) => t.name));

describe('dino registry', () => {
  it('defines at least 4 dinos', () => {
    expect(DINOS.length).toBeGreaterThanOrEqual(4);
  });

  it('has a unique id for every dino', () => {
    const ids = DINOS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives each dino a distinct model', () => {
    const models = DINOS.map((d) => d.model);
    expect(new Set(models).size).toBe(models.length);
  });

  it('does not give every dino an identical tool subset', () => {
    const fingerprints = new Set(
      DINOS.map((d) => [...d.toolNames].sort().join(',')),
    );
    expect(fingerprints.size).toBeGreaterThan(1);
  });

  it('only references tools that exist in the tools registry', () => {
    for (const dino of DINOS) {
      for (const name of dino.toolNames) {
        expect(toolNames.has(name)).toBe(true);
      }
    }
  });

  it('has a DEFAULT_DINO_ID that resolves to a real dino', () => {
    expect(DINOS.some((d) => d.id === DEFAULT_DINO_ID)).toBe(true);
  });
});

describe('getDino', () => {
  it('returns the matching dino for a known id', () => {
    expect(getDino('veloce').id).toBe('veloce');
  });

  it('falls back to the default dino for an unknown id', () => {
    expect(getDino('not-a-real-dino').id).toBe(DEFAULT_DINO_ID);
  });

  it('falls back to the default dino when id is missing', () => {
    expect(getDino(undefined).id).toBe(DEFAULT_DINO_ID);
  });

  it('never throws', () => {
    expect(() => getDino('')).not.toThrow();
    expect(() => getDino(undefined)).not.toThrow();
  });
});

describe('toDinoSummary', () => {
  it('omits the systemPrompt from every summary', () => {
    for (const dino of DINOS) {
      const summary = toDinoSummary(dino);
      expect('systemPrompt' in summary).toBe(false);
    }
  });

  it('preserves the frontend-facing fields', () => {
    const summary = toDinoSummary(getDino(DEFAULT_DINO_ID));
    expect(summary.id).toBe(DEFAULT_DINO_ID);
    expect(typeof summary.name).toBe('string');
    expect(Array.isArray(summary.toolNames)).toBe(true);
  });
});
