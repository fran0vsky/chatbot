import { describe, it, expect, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { CustomDinoService } from './custom-dinos.service';
import { MODEL_CATALOGUE } from './model-catalogue';
import { CustomDinoRow } from '../database/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a null-db connection — mirrors the no-DATABASE_URL degraded state. */
function makeNullConnection() {
  return { db: null, pool: null };
}

/** Build a CustomDinoService backed by a null DB (graceful-degradation tests). */
function makeNullDbService(): CustomDinoService {
  return new CustomDinoService(makeNullConnection() as never);
}

/** A minimal valid create request. */
const VALID_MODEL = MODEL_CATALOGUE[0].id;
const VALID_CREATE = {
  userId: 'user-1',
  name: 'TestDino',
  systemPrompt: 'Be helpful.',
  model: VALID_MODEL,
  toolNames: ['get_current_time'],
};

/** Fabricate a DB row close enough to CustomDinoRow for testing toCustomDinoSummary. */
function makeRow(overrides: Partial<CustomDinoRow> = {}): CustomDinoRow {
  return {
    id: 'abc123',
    userId: 'user-1',
    name: 'TestDino',
    species: 'Raptor',
    avatarUrl: 'https://example.com/avatar.png',
    blurb: 'A test dino',
    persona: 'Friendly',
    systemPrompt: 'SECRET — must not appear in summary',
    model: VALID_MODEL,
    toolNames: ['web_search'],
    accent: '#ff0000',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: model catalogue
// ---------------------------------------------------------------------------

describe('MODEL_CATALOGUE', () => {
  it('is non-empty', () => {
    expect(MODEL_CATALOGUE.length).toBeGreaterThan(0);
  });

  it('each entry has an id and a label', () => {
    for (const m of MODEL_CATALOGUE) {
      expect(typeof m.id).toBe('string');
      expect(m.id.length).toBeGreaterThan(0);
      expect(typeof m.label).toBe('string');
      expect(m.label.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: null-db graceful degradation
// ---------------------------------------------------------------------------

describe('CustomDinoService — null-db degradation', () => {
  let svc: CustomDinoService;

  beforeEach(() => {
    svc = makeNullDbService();
  });

  it('list() returns [] when DB is null', async () => {
    const result = await svc.list('user-1');
    expect(result).toEqual([]);
  });

  it('list() returns [] when userId is missing', async () => {
    const result = await svc.list(undefined);
    expect(result).toEqual([]);
  });

  it('create() returns null when DB is null', async () => {
    const result = await svc.create(VALID_CREATE);
    expect(result).toBeNull();
  });

  it('getById() returns null when DB is null', async () => {
    const result = await svc.getById('custom:abc123', 'user-1');
    expect(result).toBeNull();
  });

  it('update() returns null when DB is null', async () => {
    const result = await svc.update('custom:abc123', 'user-1', { name: 'New' });
    expect(result).toBeNull();
  });

  it('delete() returns void (no-op) when DB is null', async () => {
    await expect(svc.delete('custom:abc123', 'user-1')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: validation — model catalogue
// ---------------------------------------------------------------------------

describe('CustomDinoService — model validation', () => {
  it('throws BadRequestException for a model not in the catalogue when DB is present', async () => {
    // We cannot test DB paths easily without a real DB, but we CAN observe validation
    // by bypassing the null-db guard — use a fake DB that records calls.
    const inserted: unknown[] = [];
    const fakeDb = {
      insert: () => ({
        values: (vals: unknown) => {
          inserted.push(vals);
          return { returning: async () => [] };
        },
      }),
    };
    const svcWithDb = new CustomDinoService({ db: fakeDb, pool: null } as never);

    await expect(
      svcWithDb.create({ ...VALID_CREATE, model: 'not-a-real-model/v1:free' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(inserted.length).toBe(0);
  });

  it('accepts a model that is in the catalogue', async () => {
    // With a fake DB returning an empty row array create() returns null — that is fine;
    // it means validation passed (no exception thrown).
    const fakeDb = {
      insert: () => ({
        values: () => ({ returning: async () => [] }),
      }),
    };
    const svcWithDb = new CustomDinoService({ db: fakeDb, pool: null } as never);
    await expect(svcWithDb.create(VALID_CREATE)).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: validation — tool catalogue
// ---------------------------------------------------------------------------

describe('CustomDinoService — tool validation', () => {
  it('throws BadRequestException for a toolName outside the catalogue', async () => {
    const fakeDb = {
      insert: () => ({
        values: () => ({ returning: async () => [] }),
      }),
    };
    const svc = new CustomDinoService({ db: fakeDb, pool: null } as never);

    await expect(
      svc.create({ ...VALID_CREATE, toolNames: ['get_current_time', 'sudo_rm_rf'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts all three allowed tools together', async () => {
    const fakeDb = {
      insert: () => ({
        values: () => ({ returning: async () => [] }),
      }),
    };
    const svc = new CustomDinoService({ db: fakeDb, pool: null } as never);
    await expect(
      svc.create({
        ...VALID_CREATE,
        toolNames: ['get_current_time', 'web_search', 'fetch_page'],
      }),
    ).resolves.toBeNull();
  });

  it('accepts an empty toolNames array', async () => {
    const fakeDb = {
      insert: () => ({
        values: () => ({ returning: async () => [] }),
      }),
    };
    const svc = new CustomDinoService({ db: fakeDb, pool: null } as never);
    await expect(
      svc.create({ ...VALID_CREATE, toolNames: [] }),
    ).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: custom: id prefix
// ---------------------------------------------------------------------------

describe('CustomDinoService — custom: id prefix', () => {
  let svc: CustomDinoService;

  beforeEach(() => {
    svc = makeNullDbService();
  });

  it('toCustomDinoSummary returns an id prefixed with custom:', () => {
    const row = makeRow({ id: 'deadbeef-1234-5678-abcd-000000000001' });
    const summary = svc.toCustomDinoSummary(row);
    expect(summary.id).toBe('custom:deadbeef-1234-5678-abcd-000000000001');
  });

  it('getById returns null when publicId lacks the custom: prefix', async () => {
    // null DB, but we can verify that the prefix check returns null before any DB call
    const result = await svc.getById('no-prefix-id', 'user-1');
    expect(result).toBeNull();
  });

  it('delete no-ops when publicId lacks the custom: prefix', async () => {
    await expect(svc.delete('no-prefix-id', 'user-1')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: toCustomDinoSummary — no systemPrompt, explicit allowlist
// ---------------------------------------------------------------------------

describe('CustomDinoService — toCustomDinoSummary projection', () => {
  let svc: CustomDinoService;

  beforeEach(() => {
    svc = makeNullDbService();
  });

  it('does NOT include systemPrompt in the summary', () => {
    const row = makeRow();
    const summary = svc.toCustomDinoSummary(row);
    expect('systemPrompt' in summary).toBe(false);
  });

  it('does NOT include userId in the summary', () => {
    const row = makeRow();
    const summary = svc.toCustomDinoSummary(row);
    expect('userId' in summary).toBe(false);
  });

  it('includes expected public fields', () => {
    const row = makeRow();
    const summary = svc.toCustomDinoSummary(row);
    expect(summary.id).toMatch(/^custom:/);
    expect(summary.name).toBe(row.name);
    expect(summary.species).toBe(row.species);
    expect(summary.model).toBe(row.model);
    expect(Array.isArray(summary.toolNames)).toBe(true);
    expect(summary.avatarUrl).toBe(row.avatarUrl);
    expect(summary.accent).toBe(row.accent);
  });

  it('returns empty string for optional fields not set on the row', () => {
    const row = makeRow({ species: null, persona: null, blurb: null });
    const summary = svc.toCustomDinoSummary(row);
    expect(summary.species).toBe('');
    expect(summary.persona).toBe('');
    expect(summary.blurb).toBe('');
  });

  it('toolNames defaults to [] when jsonb value is not an array', () => {
    const row = makeRow({ toolNames: null as never });
    const summary = svc.toCustomDinoSummary(row);
    expect(summary.toolNames).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: 42-REVIEW fix — CR-02: update() rejects empty patch
// ---------------------------------------------------------------------------

describe('CustomDinoService — CR-02: update rejects empty patch', () => {
  it('throws BadRequestException when update request has no defined fields', async () => {
    const fakeDb = {
      update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
    };
    const svc = new CustomDinoService({ db: fakeDb, pool: null } as never);
    await expect(svc.update('custom:abc123', 'user-1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not reject when at least one field is provided', async () => {
    const fakeDb = {
      update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
    };
    const svc = new CustomDinoService({ db: fakeDb, pool: null } as never);
    // Returns null (no row returned by fake DB) but does not throw
    await expect(svc.update('custom:abc123', 'user-1', { name: 'New name' })).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: 42-REVIEW fix — WR-01: validation errors are not swallowed to null
// ---------------------------------------------------------------------------

describe('CustomDinoService — WR-01: catch block re-throws HttpException', () => {
  it('create() re-throws BadRequestException from validation (model check)', async () => {
    // Even if a future code path throws inside the try block, it must surface
    // as a 400. We simulate this with a fakeDb whose .insert() throws a BadRequestException.
    const fakeDb = {
      insert: () => ({
        values: () => ({
          returning: async () => {
            throw new BadRequestException('injected validation error');
          },
        }),
      }),
    };
    const svc = new CustomDinoService({ db: fakeDb, pool: null } as never);
    await expect(svc.create(VALID_CREATE)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update() re-throws BadRequestException thrown inside try block', async () => {
    const fakeDb = {
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => {
              throw new BadRequestException('injected validation error');
            },
          }),
        }),
      }),
    };
    const svc = new CustomDinoService({ db: fakeDb, pool: null } as never);
    // Provide a non-empty patch so CR-02 guard does not fire
    await expect(svc.update('custom:abc123', 'user-1', { name: 'X' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ---------------------------------------------------------------------------
// Tests: 42-REVIEW fix — WR-03: invalid avatarUrl rejected on create
// ---------------------------------------------------------------------------

describe('CustomDinoService — WR-03: avatarUrl validation', () => {
  it('rejects a javascript: avatarUrl on create', async () => {
    const fakeDb = {
      insert: () => ({ values: () => ({ returning: async () => [] }) }),
    };
    const svc = new CustomDinoService({ db: fakeDb, pool: null } as never);
    await expect(
      svc.create({ ...VALID_CREATE, avatarUrl: 'javascript:alert(1)' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a non-URL string on create', async () => {
    const fakeDb = {
      insert: () => ({ values: () => ({ returning: async () => [] }) }),
    };
    const svc = new CustomDinoService({ db: fakeDb, pool: null } as never);
    await expect(
      svc.create({ ...VALID_CREATE, avatarUrl: 'not-a-url' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a valid https avatarUrl on create', async () => {
    const fakeDb = {
      insert: () => ({ values: () => ({ returning: async () => [] }) }),
    };
    const svc = new CustomDinoService({ db: fakeDb, pool: null } as never);
    // Returns null (empty returning array) but does NOT throw
    await expect(
      svc.create({ ...VALID_CREATE, avatarUrl: 'https://cdn.example.com/avatar.png' }),
    ).resolves.toBeNull();
  });

  it('rejects a javascript: avatarUrl on update', async () => {
    const fakeDb = {
      update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
    };
    const svc = new CustomDinoService({ db: fakeDb, pool: null } as never);
    await expect(
      svc.update('custom:abc123', 'user-1', { avatarUrl: 'javascript:alert(1)' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
