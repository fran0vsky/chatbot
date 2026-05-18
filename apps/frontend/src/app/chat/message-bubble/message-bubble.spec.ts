import { TestBed } from '@angular/core/testing';
import { MessageBubble } from './message-bubble';
import { ChatMessage } from '../chat.types';

describe('MessageBubble', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageBubble],
    }).compileComponents();
  });

  function render(message: ChatMessage, typing = false): HTMLElement {
    const fixture = TestBed.createComponent(MessageBubble);
    fixture.componentRef.setInput('message', message);
    fixture.componentRef.setInput('typing', typing);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders user messages right-aligned with the blue bubble', () => {
    const el = render({ text: 'hi', role: 'user' });
    expect(el.querySelector('.justify-end')).not.toBeNull();
    expect(el.querySelector('.bg-blue-500')).not.toBeNull();
    expect(el.textContent).toContain('hi');
  });

  it('renders assistant messages left-aligned with the gray bubble', () => {
    const el = render({ text: 'response', role: 'assistant' });
    expect(el.querySelector('.justify-start')).not.toBeNull();
    expect(el.querySelector('.bg-gray-100')).not.toBeNull();
    expect(el.textContent).toContain('response');
  });

  it('renders error messages with red tint and a warning svg', () => {
    const el = render({ text: 'Something went wrong. Please try again.', role: 'error' });
    expect(el.querySelector('.bg-red-50')).not.toBeNull();
    expect(el.querySelector('.text-red-700')).not.toBeNull();
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.textContent).toContain('Something went wrong');
  });

  it('renders animated dots and no text when typing is true', () => {
    const el = render({ text: '', role: 'assistant' }, true);
    const dots = el.querySelectorAll('.animate-bounce');
    expect(dots.length).toBe(3);
  });
});
