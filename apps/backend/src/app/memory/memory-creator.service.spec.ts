import { describe, it, expect, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  MemoryCreatorService,
  parseReconcile,
  parseSynthesized,
} from './memory-creator.service';
import type { MemoryService } from './memory.service';

// --- Pure helper tests (no LLM, no network) ---

describe('parseSynthesized', () => {
  it('parses clean JSON', () => {
    const raw = '{"title":"British","whenToActivate":"always","instruction":"Answer in British English"}';
    expect(parseSynthesized(raw, 'fallback')).toEqual({
      title: 'British',
      whenToActivate: 'always',
      instruction: 'Answer in British English',
    });
  });

  it('parses JSON wrapped in ``` fences', () => {
    const raw = '```json\n{"title":"Terse","whenToActivate":"","instruction":"Be brief"}\n```';
    expect(parseSynthesized(raw, 'fallback')).toEqual({
      title: 'Terse',
      whenToActivate: '',
      instruction: 'Be brief',
    });
  });

  it('falls back to raw input as instruction on garbage', () => {
    expect(parseSynthesized('not json at all', 'use me as instruction')).toEqual({
      title: '',
      whenToActivate: '',
      instruction: 'use me as instruction',
    });
  });

  it('uses fallback instruction when JSON omits/blank instruction', () => {
    const raw = '{"title":"X","whenToActivate":"y"}';
    expect(parseSynthesized(raw, 'fallback instr')).toEqual({
      title: 'X',
      whenToActivate: 'y',
      instruction: 'fallback instr',
    });
  });
});

describe('parseReconcile', () => {
  it('extracts decision: new', () => {
    expect(parseReconcile('{"decision":"new"}')).toEqual({
      decision: 'new',
      mergedTitle: undefined,
      mergedWhenToActivate: undefined,
      mergedInstruction: undefined,
    });
  });

  it('extracts decision: <id> with merged fields', () => {
    const raw =
      '```\n{"decision":"skill-7","mergedTitle":"Merged","mergedWhenToActivate":"on code","mergedInstruction":"Do both"}\n```';
    expect(parseReconcile(raw)).toEqual({
      decision: 'skill-7',
      mergedTitle: 'Merged',
      mergedWhenToActivate: 'on code',
      mergedInstruction: 'Do both',
    });
  });

  it('defaults to new on garbage', () => {
    expect(parseReconcile('???')).toEqual({ decision: 'new' });
  });
});

// --- Reconcile-routing tests (mocked MemoryService + stubbed LLM call) ---

interface FakeMemory {
  getSkills: ReturnType<typeof vi.fn>;
  addSkill: ReturnType<typeof vi.fn>;
  updateSkill: ReturnType<typeof vi.fn>;
}

function makeService(memory: FakeMemory, llmReply: string | (() => Promise<string>)) {
  const svc = new MemoryCreatorService(memory as unknown as MemoryService);
  // Stub the single private LLM seam so tests never hit OpenRouter.
  const stub =
    typeof llmReply === 'function' ? llmReply : () => Promise.resolve(llmReply);
  (svc as unknown as { invokeWithFallback: () => Promise<string> }).invokeWithFallback = stub;
  return svc;
}

const ITEM = { title: 'British', whenToActivate: '', instruction: 'Answer in British English' };

describe('MemoryCreatorService.reconcileAndSave', () => {
  it('creates when there are no existing skills (no LLM call)', async () => {
    const memory: FakeMemory = {
      getSkills: vi.fn().mockResolvedValue([]),
      addSkill: vi.fn().mockResolvedValue({ id: 's1', title: 'British', instruction: 'Answer in British English', whenToActivate: null }),
      updateSkill: vi.fn(),
    };
    const llm = vi.fn(() => Promise.resolve('{"decision":"new"}'));
    const svc = makeService(memory, llm);

    const res = await svc.reconcileAndSave('u1', 'rexford', ITEM);

    expect(res.action).toBe('created');
    expect(res.skill).toMatchObject({ id: 's1', title: 'British', whenToActivate: undefined });
    expect(memory.addSkill).toHaveBeenCalledWith('u1', 'rexford', 'British', 'Answer in British English', '');
    expect(memory.updateSkill).not.toHaveBeenCalled();
    expect(llm).not.toHaveBeenCalled(); // empty existing => skip reconcile call
  });

  it('updates when the reconcile decision is an existing id', async () => {
    const memory: FakeMemory = {
      getSkills: vi.fn().mockResolvedValue([
        { id: 'skill-7', title: 'Old', instruction: 'old instr', whenToActivate: null },
      ]),
      addSkill: vi.fn(),
      updateSkill: vi.fn().mockResolvedValue({ id: 'skill-7', title: 'Merged', instruction: 'Do both', whenToActivate: null }),
    };
    const svc = makeService(
      memory,
      '{"decision":"skill-7","mergedTitle":"Merged","mergedInstruction":"Do both"}',
    );

    const res = await svc.reconcileAndSave('u1', 'rexford', ITEM);

    expect(res.action).toBe('updated');
    expect(res.skill).toMatchObject({ id: 'skill-7', title: 'Merged' });
    expect(memory.updateSkill).toHaveBeenCalledWith('skill-7', {
      title: 'Merged',
      whenToActivate: '',
      instruction: 'Do both',
    });
    expect(memory.addSkill).not.toHaveBeenCalled();
  });

  it('creates when the reconcile decision is "new" despite existing skills', async () => {
    const memory: FakeMemory = {
      getSkills: vi.fn().mockResolvedValue([
        { id: 'skill-7', title: 'Old', instruction: 'old instr', whenToActivate: null },
      ]),
      addSkill: vi.fn().mockResolvedValue({ id: 's2', title: 'British', instruction: 'Answer in British English', whenToActivate: null }),
      updateSkill: vi.fn(),
    };
    const svc = makeService(memory, '{"decision":"new"}');

    const res = await svc.reconcileAndSave('u1', 'rexford', ITEM);

    expect(res.action).toBe('created');
    expect(memory.addSkill).toHaveBeenCalledWith('u1', 'rexford', 'British', 'Answer in British English', '');
    expect(memory.updateSkill).not.toHaveBeenCalled();
  });

  it('throws ServiceUnavailableException when addSkill returns null (DB off)', async () => {
    const memory: FakeMemory = {
      getSkills: vi.fn().mockResolvedValue([]),
      addSkill: vi.fn().mockResolvedValue(null),
      updateSkill: vi.fn(),
    };
    const svc = makeService(memory, '{"decision":"new"}');

    await expect(svc.reconcileAndSave('u1', 'rexford', ITEM)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('throws ServiceUnavailableException when updateSkill returns null (DB off)', async () => {
    const memory: FakeMemory = {
      getSkills: vi.fn().mockResolvedValue([
        { id: 'skill-7', title: 'Old', instruction: 'old instr', whenToActivate: null },
      ]),
      addSkill: vi.fn(),
      updateSkill: vi.fn().mockResolvedValue(null),
    };
    const svc = makeService(memory, '{"decision":"skill-7"}');

    await expect(svc.reconcileAndSave('u1', 'rexford', ITEM)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
