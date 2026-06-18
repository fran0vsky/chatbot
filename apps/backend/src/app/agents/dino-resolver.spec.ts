import { describe, it, expect } from 'vitest';
import { CustomDino } from '@org/shared-types';
import { customDinoToDino, resolveDino } from './dino-resolver';
import { MODEL_CATALOGUE } from './model-catalogue';

// ---------------------------------------------------------------------------
// Fake CustomDinoService
// ---------------------------------------------------------------------------

/** A minimal fake CustomDinoService that stubs getById. */
function makeCustomDinoService(customDino: CustomDino | null = null) {
  return {
    getById: async (_id: string, _userId: string | undefined): Promise<CustomDino | null> =>
      customDino,
  } as unknown as import('./custom-dinos.service').CustomDinoService;
}

// ---------------------------------------------------------------------------
// A valid custom dino fixture
// ---------------------------------------------------------------------------

const VALID_MODEL = MODEL_CATALOGUE[0].id;

const CUSTOM_DINO: CustomDino = {
  id: 'custom:deadbeef-0000-0000-0000-000000000001',
  userId: 'user-1',
  name: 'Zephyr',
  species: 'Pterodactyl',
  persona: 'A breezy tester',
  blurb: 'Blurb text',
  systemPrompt: 'You are Zephyr, a test dino.',
  model: VALID_MODEL,
  toolNames: ['web_search', 'get_current_time'],
  accent: '#aabbcc',
  avatarUrl: 'https://example.com/zephyr.png',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Tests: customDinoToDino mapping
// ---------------------------------------------------------------------------

describe('customDinoToDino', () => {
  it('maps id, name, model, systemPrompt, toolNames from the custom dino', () => {
    const dino = customDinoToDino(CUSTOM_DINO);
    expect(dino.id).toBe(CUSTOM_DINO.id);
    expect(dino.name).toBe(CUSTOM_DINO.name);
    expect(dino.model).toBe(CUSTOM_DINO.model);
    expect(dino.systemPrompt).toBe(CUSTOM_DINO.systemPrompt);
    expect(dino.toolNames).toEqual(CUSTOM_DINO.toolNames);
  });

  it('sets specialty to "Custom dino"', () => {
    const dino = customDinoToDino(CUSTOM_DINO);
    expect(dino.specialty).toBe('Custom dino');
  });

  it('imageGen is false (custom dinos are not image-gen in this phase)', () => {
    const dino = customDinoToDino(CUSTOM_DINO);
    expect(dino.imageGen).toBe(false);
  });

  it('carries avatarUrl from the custom dino', () => {
    const dino = customDinoToDino(CUSTOM_DINO);
    expect(dino.avatarUrl).toBe(CUSTOM_DINO.avatarUrl);
  });

  it('falls back to empty strings for optional fields not set', () => {
    const minimal: CustomDino = { ...CUSTOM_DINO, species: undefined, persona: undefined, blurb: undefined };
    const dino = customDinoToDino(minimal);
    expect(dino.species).toBe('');
    expect(dino.persona).toBe('');
    expect(dino.blurb).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Tests: resolveDino
// ---------------------------------------------------------------------------

describe('resolveDino', () => {
  it('undefined id → undefined (no dino)', async () => {
    const svc = makeCustomDinoService(CUSTOM_DINO);
    const result = await resolveDino(undefined, 'user-1', svc);
    expect(result).toBeUndefined();
  });

  it('built-in id resolves via getDino and returns the built-in dino', async () => {
    const svc = makeCustomDinoService(null);
    const result = await resolveDino('rexford', 'user-1', svc);
    expect(result).toBeDefined();
    expect(result!.id).toBe('rexford');
    expect(result!.name).toBe('Rexford');
  });

  it('custom: id with a matching custom dino → mapped Dino with systemPrompt + toolNames', async () => {
    const svc = makeCustomDinoService(CUSTOM_DINO);
    const result = await resolveDino(CUSTOM_DINO.id, 'user-1', svc);
    expect(result).toBeDefined();
    expect(result!.systemPrompt).toBe(CUSTOM_DINO.systemPrompt);
    expect(result!.toolNames).toEqual(CUSTOM_DINO.toolNames);
    expect(result!.specialty).toBe('Custom dino');
  });

  it('custom: id with no matching row → undefined (no silent fallback to built-in)', async () => {
    const svc = makeCustomDinoService(null);
    const result = await resolveDino('custom:00000000-0000-0000-0000-000000000000', 'user-1', svc);
    expect(result).toBeUndefined();
  });
});
