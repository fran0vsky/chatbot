import { describe, it, expect } from 'vitest';
import { MemoryService } from './memory.service';

// A minimal thenable Drizzle stand-in. Every chain method returns the builder;
// awaiting the builder resolves to the configured rows. Inserts/updates are recorded.
// `values(...)` is awaitable (writeMemories) AND has `.returning()` (addSkill).
function makeFakeDb(
  selectRows: Array<Record<string, unknown>> = [],
  updateRows?: Array<Record<string, unknown>>,
) {
  const inserted: Array<Record<string, unknown>> = [];
  const updated: Array<Record<string, unknown>> = [];
  const builder: Record<string, unknown> = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    then: (resolve: (rows: unknown) => unknown) => resolve(selectRows),
  };
  return {
    db: {
      select: () => builder,
      insert: () => ({
        values: (vals: Record<string, unknown> | Record<string, unknown>[]) => {
          const rows = Array.isArray(vals) ? vals : [vals];
          inserted.push(...rows);
          return {
            returning: () =>
              Promise.resolve(
                rows.map((v, i) => ({
                  id: `id-${i}`,
                  title: v['title'],
                  instruction: v['instruction'],
                  whenToActivate: v['whenToActivate'] ?? null,
                })),
              ),
            then: (resolve: (v: unknown) => unknown) => resolve(undefined),
          };
        },
      }),
      update: () => ({
        set: (fields: Record<string, unknown>) => {
          updated.push(fields);
          return {
            where: () => ({
              returning: () =>
                Promise.resolve(
                  updateRows ??
                    [{ id: 'upd-0', ...fields }],
                ),
            }),
          };
        },
      }),
      delete: () => ({ where: () => Promise.resolve() }),
    },
    inserted,
    updated,
  };
}

describe('MemoryService — graceful degradation (db null)', () => {
  const svc = new MemoryService({ db: null, pool: null });

  it('getMemories returns [] when DB is disabled', async () => {
    await expect(svc.getMemories('u1', 'rexford')).resolves.toEqual([]);
  });

  it('writeMemories is a no-op (does not throw) when DB is disabled', async () => {
    await expect(svc.writeMemories('u1', 'rexford', ['fact'])).resolves.toBeUndefined();
  });

  it('listMemories returns [] when DB is disabled', async () => {
    await expect(svc.listMemories('u1', 'rexford')).resolves.toEqual([]);
  });
});

describe('MemoryService — scoping & query shaping', () => {
  it('getMemories returns [] when userId is missing even with a live db', async () => {
    const fake = makeFakeDb([{ content: 'x' }]);
    const svc = new MemoryService({ db: fake.db as never, pool: null });
    await expect(svc.getMemories(undefined, 'rexford')).resolves.toEqual([]);
  });

  it('getMemories maps content rows newest-first', async () => {
    const fake = makeFakeDb([{ content: 'building SpinoChat' }, { content: 'likes dinos' }]);
    const svc = new MemoryService({ db: fake.db as never, pool: null });
    await expect(svc.getMemories('u1', 'rexford')).resolves.toEqual([
      'building SpinoChat',
      'likes dinos',
    ]);
  });

  it('writeMemories inserts only facts not already stored', async () => {
    const fake = makeFakeDb([{ content: 'already known' }]);
    const svc = new MemoryService({ db: fake.db as never, pool: null });
    await svc.writeMemories('u1', 'rexford', ['already known', 'brand new']);
    expect(fake.inserted).toHaveLength(1);
    expect(fake.inserted[0]).toMatchObject({
      userId: 'u1',
      dinoId: 'rexford',
      content: 'brand new',
      source: 'extracted',
    });
  });

  it('writeMemories no-ops on empty/whitespace-only content', async () => {
    const fake = makeFakeDb([]);
    const svc = new MemoryService({ db: fake.db as never, pool: null });
    await svc.writeMemories('u1', 'rexford', ['   ', '']);
    expect(fake.inserted).toHaveLength(0);
  });
});

describe('MemoryService — skills (Phase 22)', () => {
  it('getSkills/addSkill/deleteSkill degrade gracefully when DB is disabled', async () => {
    const svc = new MemoryService({ db: null, pool: null });
    await expect(svc.getSkills('u1', 'rexford')).resolves.toEqual([]);
    await expect(svc.addSkill('u1', 'rexford', 'British', 'Answer in British English')).resolves.toBeNull();
    await expect(svc.deleteSkill('id-0')).resolves.toBeUndefined();
  });

  it('getSkills returns [] when userId is missing', async () => {
    const fake = makeFakeDb([{ id: 'x', title: 't', instruction: 'i' }]);
    const svc = new MemoryService({ db: fake.db as never, pool: null });
    await expect(svc.getSkills(undefined, 'rexford')).resolves.toEqual([]);
  });

  it('getSkills returns id/title/instruction rows', async () => {
    const fake = makeFakeDb([{ id: 's1', title: 'British', instruction: 'Answer in British English' }]);
    const svc = new MemoryService({ db: fake.db as never, pool: null });
    await expect(svc.getSkills('u1', 'rexford')).resolves.toEqual([
      { id: 's1', title: 'British', instruction: 'Answer in British English' },
    ]);
  });

  it('addSkill persists and returns the created skill', async () => {
    const fake = makeFakeDb([]);
    const svc = new MemoryService({ db: fake.db as never, pool: null });
    const created = await svc.addSkill('u1', 'rexford', 'British', 'Answer in British English');
    expect(created).toMatchObject({ title: 'British', instruction: 'Answer in British English' });
    expect(fake.inserted[0]).toMatchObject({ userId: 'u1', dinoId: 'rexford', title: 'British' });
  });

  it('addSkill returns null on empty title/instruction', async () => {
    const fake = makeFakeDb([]);
    const svc = new MemoryService({ db: fake.db as never, pool: null });
    await expect(svc.addSkill('u1', 'rexford', '  ', 'x')).resolves.toBeNull();
    await expect(svc.addSkill('u1', 'rexford', 'x', '   ')).resolves.toBeNull();
    expect(fake.inserted).toHaveLength(0);
  });

  it('addSkill persists and returns whenToActivate when provided', async () => {
    const fake = makeFakeDb([]);
    const svc = new MemoryService({ db: fake.db as never, pool: null });
    const created = await svc.addSkill('u1', 'rexford', 'British', 'Answer in British English', 'when user asks for help');
    expect(created).toMatchObject({ title: 'British', instruction: 'Answer in British English', whenToActivate: 'when user asks for help' });
    expect(fake.inserted[0]).toMatchObject({ whenToActivate: 'when user asks for help' });
  });
});

describe('MemoryService — updateSkill (Phase 33)', () => {
  it('updateSkill returns null when DB is disabled', async () => {
    const svc = new MemoryService({ db: null, pool: null });
    await expect(svc.updateSkill('id-1', { title: 'T', instruction: 'I' })).resolves.toBeNull();
  });

  it('updateSkill returns null when title is empty', async () => {
    const fake = makeFakeDb([]);
    const svc = new MemoryService({ db: fake.db as never, pool: null });
    await expect(svc.updateSkill('id-1', { title: '  ', instruction: 'I' })).resolves.toBeNull();
    expect(fake.updated).toHaveLength(0);
  });

  it('updateSkill returns null when instruction is empty', async () => {
    const fake = makeFakeDb([]);
    const svc = new MemoryService({ db: fake.db as never, pool: null });
    await expect(svc.updateSkill('id-1', { title: 'T', instruction: '' })).resolves.toBeNull();
    expect(fake.updated).toHaveLength(0);
  });

  it('updateSkill happy path returns updated SkillView with whenToActivate', async () => {
    const fake = makeFakeDb([], [{ id: 'id-1', title: 'New Title', instruction: 'New Instr', whenToActivate: 'on demand' }]);
    const svc = new MemoryService({ db: fake.db as never, pool: null });
    const result = await svc.updateSkill('id-1', { title: 'New Title', instruction: 'New Instr', whenToActivate: 'on demand' });
    expect(result).toMatchObject({ id: 'id-1', title: 'New Title', instruction: 'New Instr', whenToActivate: 'on demand' });
    expect(fake.updated[0]).toMatchObject({ title: 'New Title', instruction: 'New Instr', whenToActivate: 'on demand' });
  });

  it('updateSkill coerces blank whenToActivate to null', async () => {
    const fake = makeFakeDb([], [{ id: 'id-1', title: 'T', instruction: 'I', whenToActivate: null }]);
    const svc = new MemoryService({ db: fake.db as never, pool: null });
    const result = await svc.updateSkill('id-1', { title: 'T', instruction: 'I', whenToActivate: '   ' });
    expect(result).toMatchObject({ whenToActivate: null });
    expect(fake.updated[0]).toMatchObject({ whenToActivate: null });
  });
});
