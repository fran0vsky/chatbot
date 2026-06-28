import { ComponentRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatMessage, SideThread, StreamEvent } from '@org/shared-types';
import { SideThreadComponent } from './side-thread';
import { ChatService } from './chat.service';

/** Build an async generator that yields the given stream events. */
async function* stream(events: StreamEvent[]): AsyncGenerator<StreamEvent, void, void> {
  for (const e of events) yield e;
}

function openThread(overrides: Partial<SideThread> = {}): SideThread {
  return {
    id: 't1',
    anchorMessageId: 'm1',
    anchorPreview: 'the answer',
    messages: [],
    status: 'open',
    createdAt: 0,
    ...overrides,
  };
}

describe('SideThreadComponent', () => {
  let fixture: ComponentFixture<SideThreadComponent>;
  let component: SideThreadComponent;
  let ref: ComponentRef<SideThreadComponent>;
  let streamMessage: jest.Mock;

  beforeEach(() => {
    streamMessage = jest.fn();
    TestBed.configureTestingModule({
      imports: [SideThreadComponent],
      providers: [{ provide: ChatService, useValue: { streamMessage } }],
    });
    fixture = TestBed.createComponent(SideThreadComponent);
    component = fixture.componentInstance;
    ref = fixture.componentRef;
    ref.setInput('thread', openThread());
    ref.setInput('contextMessages', [
      { role: 'user', text: 'q1' } as ChatMessage,
      { role: 'assistant', text: 'the answer' } as ChatMessage,
    ]);
    fixture.detectChanges();
  });

  it('seeds local messages from the bound thread', () => {
    expect(component.messages()).toEqual([]);
  });

  it('appends the user turn then the assistant reply, and emits messagesChanged', async () => {
    streamMessage.mockReturnValue(
      stream([
        { type: 'token', text: 'because…' },
        { type: 'done', response: 'because X is Y', toolCalls: [] },
      ]),
    );
    const emitted: ChatMessage[][] = [];
    component.messagesChanged.subscribe((m) => emitted.push(m));

    component.onSend('are you sure?');
    await fixture.whenStable();

    const msgs = component.messages();
    expect(msgs[0]).toMatchObject({ role: 'user', text: 'are you sure?' });
    expect(msgs[msgs.length - 1]).toMatchObject({ role: 'assistant', text: 'because X is Y' });
    // Emitted at least twice: once after user turn, once after assistant turn.
    expect(emitted.length).toBeGreaterThanOrEqual(2);
  });

  it('sends branch context (main-up-to-anchor + branch turns) as history', async () => {
    streamMessage.mockReturnValue(stream([{ type: 'done', response: 'ok', toolCalls: [] }]));
    component.onSend('follow up');
    await fixture.whenStable();

    expect(streamMessage).toHaveBeenCalledTimes(1);
    const history = streamMessage.mock.calls[0][4];
    expect(history).toEqual([
      { role: 'user', text: 'q1' },
      { role: 'assistant', text: 'the answer' },
    ]);
  });

  it('gates Merge until the dino has answered', async () => {
    expect(component.canMerge()).toBe(false);
    streamMessage.mockReturnValue(stream([{ type: 'done', response: 'ans', toolCalls: [] }]));
    component.onSend('q');
    await fixture.whenStable();
    expect(component.canMerge()).toBe(true);
  });

  it('emits the transcript on merge', async () => {
    streamMessage.mockReturnValue(stream([{ type: 'done', response: 'ans', toolCalls: [] }]));
    component.onSend('q');
    await fixture.whenStable();

    const merged = jest.fn();
    component.merge.subscribe(merged);
    component.onMerge();
    expect(merged).toHaveBeenCalledTimes(1);
    expect(merged.mock.calls[0][0].some((m: ChatMessage) => m.text === 'ans')).toBe(true);
  });

  it('does not send while busy (main stream active)', () => {
    ref.setInput('busy', true);
    fixture.detectChanges();
    component.onSend('blocked');
    expect(streamMessage).not.toHaveBeenCalled();
    expect(component.messages()).toEqual([]);
  });

  it('emits discard without touching the main context', () => {
    const discarded = jest.fn();
    component.discard.subscribe(discarded);
    component.onDiscard();
    expect(discarded).toHaveBeenCalledTimes(1);
  });
});
