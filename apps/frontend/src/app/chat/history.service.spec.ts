import { TestBed } from '@angular/core/testing';
import { HistoryService } from './history.service';
import { ConversationSession } from '@org/shared-types';

describe('HistoryService reasoning round-trip', () => {
  let service: HistoryService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(HistoryService);
  });

  it('round-trips reasoning and reasoningDurationMs on assistant messages', () => {
    const session: ConversationSession = {
      id: 'session-1',
      title: 'Test',
      createdAt: Date.now(),
      messages: [
        { text: 'Hi', role: 'user' },
        {
          text: 'Hello',
          role: 'assistant',
          reasoning: 'I thought about this',
          reasoningDurationMs: 2000,
        },
      ],
    };
    service.upsertSession(session);
    const loaded = service.loadSessions();
    const msg = loaded[0].messages[1];
    expect(msg.reasoning).toBe('I thought about this');
    expect(msg.reasoningDurationMs).toBe(2000);
  });

  it('does not materialize reasoning keys for messages without reasoning', () => {
    const session: ConversationSession = {
      id: 'session-2',
      title: 'Plain',
      createdAt: Date.now(),
      messages: [
        { text: 'User msg', role: 'user' },
        { text: 'Assistant msg', role: 'assistant' },
      ],
    };
    service.upsertSession(session);
    const loaded = service.loadSessions();
    const msg = loaded[0].messages[1];
    expect(msg.reasoning).toBeUndefined();
    expect(msg.reasoningDurationMs).toBeUndefined();
  });
});
