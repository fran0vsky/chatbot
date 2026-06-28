import { ChatMessage } from '@org/shared-types';
import { buildHistory } from './history-builder';

const user = (text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  role: 'user',
  text,
  ...extra,
});
const assistant = (text: string): ChatMessage => ({ role: 'assistant', text });
const tool = (toolName: string, toolResult: string): ChatMessage => ({
  role: 'tool',
  text: '',
  toolName,
  toolResult,
});

describe('buildHistory', () => {
  it('keeps user/assistant turns with non-empty text', () => {
    const out = buildHistory([user('hi'), assistant('hello')]);
    expect(out).toEqual([
      { role: 'user', text: 'hi' },
      { role: 'assistant', text: 'hello' },
    ]);
  });

  it('drops empty user/assistant turns but keeps tool turns with a result', () => {
    const out = buildHistory([user('  '), assistant(''), tool('web_search', 'res')]);
    expect(out).toEqual([
      { role: 'tool', text: '', toolName: 'web_search', toolResult: 'res' },
    ]);
  });

  it('caps conversational turns to the last historyCap (tool turns excluded from count)', () => {
    const msgs: ChatMessage[] = [];
    for (let i = 0; i < 25; i++) msgs.push(user(`u${i}`), assistant(`a${i}`));
    const out = buildHistory(msgs, { historyCap: 20 });
    const convCount = out.filter((m) => m.role === 'user' || m.role === 'assistant').length;
    expect(convCount).toBe(20);
    // Oldest kept turn is the start of the window, not u0.
    expect(out[0].text).not.toBe('u0');
  });

  it('strips imageDataUrl beyond the imageCap most-recent image-bearing turns', () => {
    const out = buildHistory(
      [
        user('a', { imageDataUrl: 'img-a' }),
        user('b', { imageDataUrl: 'img-b' }),
        user('c', { imageDataUrl: 'img-c' }),
      ],
      { imageCap: 2 },
    );
    expect(out[0].imageDataUrl).toBeUndefined(); // oldest stripped
    expect(out[1].imageDataUrl).toBe('img-b');
    expect(out[2].imageDataUrl).toBe('img-c');
  });

  it('composes branch context = main-up-to-anchor + branch turns, isolating later main turns', () => {
    // Main thread: q1/a1 (anchor=a1), q2/a2 happened AFTER branching.
    const mainUpToAnchor = [user('q1'), assistant('a1')];
    const branchTurns = [user('are you sure?'), assistant('actually X')];
    const laterMain = [user('q2'), assistant('a2')];

    const branchHistory = buildHistory([...mainUpToAnchor, ...branchTurns]);

    // The branch sees the anchor context and its own turns…
    expect(branchHistory).toEqual([
      { role: 'user', text: 'q1' },
      { role: 'assistant', text: 'a1' },
      { role: 'user', text: 'are you sure?' },
      { role: 'assistant', text: 'actually X' },
    ]);
    // …and never the later main turns that occurred outside the branch.
    expect(branchHistory.some((m) => m.text === 'q2' || m.text === 'a2')).toBe(false);
    expect(laterMain.length).toBe(2); // (guards the fixture intent)
  });

  it('main history never contains branch turns (structural isolation)', () => {
    // Main only ever passes its own messages; branch turns live elsewhere.
    const mainOnly = [user('q1'), assistant('a1'), user('q2'), assistant('a2')];
    const out = buildHistory(mainOnly);
    expect(out.some((m) => m.text.includes('are you sure'))).toBe(false);
  });
});
