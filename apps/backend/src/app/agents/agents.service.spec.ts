import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveActiveTools } from './agents.service';
import { tools } from './tools';
import { getDino } from './dinos';
import type { ChatHistoryItem } from '@org/shared-types';

const ALL = tools.map((t) => t.name);

// ---------------------------------------------------------------------------
// resolveActiveTools unit tests (pre-existing)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// streamAgent history reconstruction tests
// ---------------------------------------------------------------------------
// These tests verify the conversation array that reaches the LLM is built
// correctly for three cases: image replay, tool replay, and single-turn parity.
//
// Strategy: mock ChatOpenAI so its invoke() captures the messages array and
// immediately returns a minimal response (no tool_calls) so the loop exits.
// ---------------------------------------------------------------------------

const captured = vi.hoisted(() => ({ messages: [] as unknown[] }));

vi.mock('@langchain/openai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@langchain/openai')>();
  // Use a regular function (not an arrow function) so `new MockChatOpenAI()`
  // works — returning an object from a constructor yields that object.
  function MockChatOpenAI() {
    return {
      bindTools() { return this; },
      invoke(messages: unknown[]) {
        captured.messages = [...messages];
        return Promise.resolve({ content: 'mock response', tool_calls: [] });
      },
    };
  }
  return { ...actual, ChatOpenAI: MockChatOpenAI };
});

// Import AgentsService after the vi.mock registration (mock is hoisted, so
// the factory fires before any imports in this file execute at module init).
const { AgentsService } = await import('./agents.service');

// Minimal MemoryService stub — no real DB interaction.
const memoryStub = {
  getMemories: vi.fn().mockResolvedValue([]),
  getSkills: vi.fn().mockResolvedValue([]),
  writeMemories: vi.fn().mockResolvedValue(undefined),
};

/** Drain an AsyncGenerator collecting all yielded events. */
async function collectEvents(
  gen: AsyncGenerator<unknown, void, void>,
): Promise<unknown[]> {
  const events: unknown[] = [];
  for await (const ev of gen) {
    events.push(ev);
  }
  return events;
}

describe('streamAgent — history reconstruction', () => {
  let service: InstanceType<typeof AgentsService>;

  beforeEach(() => {
    captured.messages = [];
    service = new AgentsService(memoryStub as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('image replay: builds a multimodal HumanMessage for a prior user turn with imageDataUrl', async () => {
    const history: ChatHistoryItem[] = [
      {
        role: 'user',
        text: 'Look at this image',
        imageDataUrl: 'data:image/png;base64,abc123',
      },
      { role: 'assistant', text: 'I can see the image.' },
    ];

    await collectEvents(
      service.streamAgent(
        'follow-up question',
        'thread-1',
        'openai/gpt-4o-mini',
        new AbortController().signal,
        [],   // no tools
        undefined,
        undefined,
        history,
      ),
    );

    // Find any message whose content is an array containing an image_url entry.
    // LangChain HumanMessage stores content as the first arg to constructor.
    const multimodalMsg = captured.messages.find(
      (m) =>
        typeof m === 'object' &&
        m !== null &&
        Array.isArray((m as Record<string, unknown>)['content']) &&
        ((m as Record<string, unknown>)['content'] as Array<{ type?: string }>).some(
          (c) => c.type === 'image_url',
        ),
    );

    expect(multimodalMsg).toBeDefined();
    const content = (
      multimodalMsg as { content: Array<{ type: string; image_url?: { url: string } }> }
    ).content;
    const imageEntry = content.find((c) => c.type === 'image_url');
    expect(imageEntry?.image_url?.url).toBe('data:image/png;base64,abc123');
  });

  it('tool replay: builds AIMessage(tool_calls) + ToolMessage pair for a prior tool item', async () => {
    const history: ChatHistoryItem[] = [
      { role: 'user', text: 'Fetch that page for me' },
      {
        role: 'tool',
        text: '',
        toolName: 'fetch_page',
        toolArgs: { url: 'https://example.com' },
        toolResult: '<html>Page content here</html>',
      },
      { role: 'assistant', text: 'Here is a summary of the page.' },
    ];

    await collectEvents(
      service.streamAgent(
        'summarize again',
        'thread-2',
        'openai/gpt-4o-mini',
        new AbortController().signal,
        [],
        undefined,
        undefined,
        history,
      ),
    );

    // The AIMessage with tool_calls should appear in the conversation.
    const aiWithToolCalls = captured.messages.find(
      (m) => {
        if (typeof m !== 'object' || m === null) return false;
        const tc = (m as Record<string, unknown>)['tool_calls'];
        if (!Array.isArray(tc) || tc.length === 0) return false;
        return (tc as Array<{ name?: string }>)[0].name === 'fetch_page';
      },
    );
    expect(aiWithToolCalls).toBeDefined();

    const toolCallId = (
      aiWithToolCalls as { tool_calls: Array<{ id: string }> }
    ).tool_calls[0].id;

    // A ToolMessage with a matching tool_call_id must follow.
    const toolMsg = captured.messages.find(
      (m) =>
        typeof m === 'object' &&
        m !== null &&
        (m as Record<string, unknown>)['tool_call_id'] === toolCallId,
    );
    expect(toolMsg).toBeDefined();
    expect((toolMsg as Record<string, unknown>)['content']).toBe(
      '<html>Page content here</html>',
    );
  });

  it('single-turn parity: plain user/assistant history yields no extra ToolMessages', async () => {
    const history: ChatHistoryItem[] = [
      { role: 'user', text: 'Hello' },
      { role: 'assistant', text: 'Hi there!' },
    ];

    await collectEvents(
      service.streamAgent(
        'How are you?',
        'thread-3',
        'openai/gpt-4o-mini',
        new AbortController().signal,
        [],
        undefined,
        undefined,
        history,
      ),
    );

    // No ToolMessages (no tool_call_id property) should be in the conversation.
    const toolMessages = captured.messages.filter(
      (m) =>
        typeof m === 'object' &&
        m !== null &&
        'tool_call_id' in (m as Record<string, unknown>),
    );
    expect(toolMessages).toHaveLength(0);

    // Verify plain history items are in the conversation as simple string content.
    const helloMsg = captured.messages.find(
      (m) =>
        typeof m === 'object' &&
        m !== null &&
        (m as Record<string, unknown>)['content'] === 'Hello',
    );
    const hiMsg = captured.messages.find(
      (m) =>
        typeof m === 'object' &&
        m !== null &&
        (m as Record<string, unknown>)['content'] === 'Hi there!',
    );

    expect(helloMsg).toBeDefined();
    expect(hiMsg).toBeDefined();
  });
});
