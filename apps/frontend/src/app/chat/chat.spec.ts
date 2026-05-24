import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ChatComponent } from './chat';
import { ChatService } from './chat.service';
import { HistoryService } from './history.service';
import { StreamEvent } from '@org/shared-types';

type ChatComponentPrivate = {
  handleStreamEvent(event: StreamEvent): void;
};

function buildChatService(): Partial<ChatService> {
  return {
    currentThreadId: 'test-thread',
    streamMessage: vi.fn().mockReturnValue((async function* () {})()),
    resetThread: vi.fn(),
    setThread: vi.fn(),
  };
}

function buildHistoryService(): Partial<HistoryService> {
  return {
    loadSessions: vi.fn().mockReturnValue([]),
    upsertSession: vi.fn().mockReturnValue([]),
  };
}

describe('ChatComponent reasoning handling', () => {
  let component: ChatComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ChatService, useValue: buildChatService() },
        { provide: HistoryService, useValue: buildHistoryService() },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const dispatch = (event: StreamEvent) =>
    (component as unknown as ChatComponentPrivate).handleStreamEvent(event);

  it('accumulates reasoning_token events into streamingReasoning signal', () => {
    dispatch({ type: 'reasoning_token', text: 'part1' });
    dispatch({ type: 'reasoning_token', text: 'part2' });
    expect(component.streamingReasoning()).toBe('part1part2');
  });

  it('collapses reasoning when the first content token arrives', () => {
    dispatch({ type: 'reasoning_token', text: 'think' });
    expect(component.reasoningCollapsed()).toBe(false);
    dispatch({ type: 'token', text: 'answer' });
    expect(component.reasoningCollapsed()).toBe(true);
  });

  it('does NOT collapse reasoning if streamingReasoning is empty when a token arrives', () => {
    dispatch({ type: 'token', text: 'answer' });
    expect(component.reasoningCollapsed()).toBe(false);
  });

  it('persists reasoning and durationMs on done event', () => {
    dispatch({
      type: 'done',
      response: 'the answer',
      toolCalls: [],
      reasoning: 'my reasoning',
      reasoningDurationMs: 1500,
    });
    const last = component.messages[component.messages.length - 1];
    expect(last.reasoning).toBe('my reasoning');
    expect(last.reasoningDurationMs).toBe(1500);
  });

  it('omits reasoning/durationMs keys when done has no reasoning', () => {
    dispatch({ type: 'done', response: 'answer', toolCalls: [] });
    const last = component.messages[component.messages.length - 1];
    expect('reasoning' in last).toBe(false);
    expect('reasoningDurationMs' in last).toBe(false);
  });

  it('resets streamingReasoning and reasoningCollapsed after done', () => {
    dispatch({ type: 'reasoning_token', text: 'think' });
    dispatch({ type: 'token', text: 'answer' });
    dispatch({ type: 'done', response: 'final', toolCalls: [], reasoning: 'think' });
    expect(component.streamingReasoning()).toBe('');
    expect(component.reasoningCollapsed()).toBe(false);
  });
});
