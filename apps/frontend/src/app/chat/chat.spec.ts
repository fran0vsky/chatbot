import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { of } from 'rxjs';
import { ChatComponent } from './chat';
import { ChatService } from './chat.service';
import { DinoService } from './dino.service';
import { HistoryService } from './history.service';
import { StreamEvent } from '@org/shared-types';
import { reducers } from '../store/reducers';
import { appEffects } from '../store/effects';

type ChatComponentPrivate = {
  handleStreamEvent(event: StreamEvent): void;
};

// eslint-disable-next-line require-yield
async function* emptyStream(): AsyncGenerator<StreamEvent, void, void> {
  return;
}

function buildChatService(): Partial<ChatService> {
  return {
    currentThreadId: 'test-thread',
    streamMessage: vi.fn().mockReturnValue(emptyStream()),
    resetThread: vi.fn(),
    setThread: vi.fn(),
  };
}

function buildHistoryService(): Partial<HistoryService> {
  return {
    loadSessions: vi.fn().mockReturnValue([]),
    upsertSession: vi.fn().mockReturnValue([]),
    deleteSession: vi.fn().mockReturnValue([]),
    updateTitle: vi.fn().mockReturnValue([]),
    togglePin: vi.fn().mockReturnValue([]),
  };
}

function buildDinoService(): Partial<DinoService> {
  return {
    dinos: signal([]),
    loaded: signal(false),
    loadDinos: vi.fn(),
    fetchDinos: vi.fn().mockReturnValue(of([])),
    getById: vi.fn().mockReturnValue(undefined),
  };
}

describe('ChatComponent reasoning handling', () => {
  let component: ChatComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatComponent],
      providers: [
        provideNoopAnimations(),
        provideStore(reducers),
        provideEffects(appEffects),
        { provide: ChatService, useValue: buildChatService() },
        { provide: HistoryService, useValue: buildHistoryService() },
        { provide: DinoService, useValue: buildDinoService() },
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
    const msgs = component.messages();
    const last = msgs[msgs.length - 1];
    expect(last.reasoning).toBe('my reasoning');
    expect(last.reasoningDurationMs).toBe(1500);
  });

  it('omits reasoning/durationMs keys when done has no reasoning', () => {
    dispatch({ type: 'done', response: 'answer', toolCalls: [] });
    const msgs = component.messages();
    const last = msgs[msgs.length - 1];
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
