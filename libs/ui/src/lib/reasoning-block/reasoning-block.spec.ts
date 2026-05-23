import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ReasoningBlock } from './reasoning-block';

describe('ReasoningBlock', () => {
  let fixture: ComponentFixture<ReasoningBlock>;
  let component: ReasoningBlock;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReasoningBlock],
    }).compileComponents();
    fixture = TestBed.createComponent(ReasoningBlock);
    component = fixture.componentInstance;
  });

  describe('rendering gate', () => {
    it('renders nothing when reasoning is empty', () => {
      component.reasoning = '';
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector('button');
      const wrapper = fixture.nativeElement.querySelector('div.border-l-2');
      expect(button).toBeNull();
      expect(wrapper).toBeNull();
    });

    it('renders nothing when reasoning is whitespace-only', () => {
      component.reasoning = '   \n\t  ';
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('button')).toBeNull();
    });

    it('renders toggle when reasoning is non-empty', () => {
      component.reasoning = 'hello';
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector('button');
      expect(button).not.toBeNull();
      expect(button!.textContent!.trim()).toContain(component.actionLabel());
    });
  });

  describe('durationLabel()', () => {
    it('returns "Thought for <1s" for durationMs = 450', () => {
      component.durationMs = 450;
      expect(component.durationLabel()).toBe('Thought for <1s');
    });

    it('returns "Thought for 4s" for durationMs = 4200 (rounding)', () => {
      component.durationMs = 4200;
      expect(component.durationLabel()).toBe('Thought for 4s');
    });

    it('returns "Thinking…" when streaming=true and durationMs undefined', () => {
      component.streaming = true;
      component.durationMs = undefined;
      expect(component.durationLabel()).toBe('Thinking…');
    });

    it('returns empty string when not streaming and no duration', () => {
      component.streaming = false;
      component.durationMs = undefined;
      expect(component.durationLabel()).toBe('');
    });
  });

  describe('toggle()', () => {
    it('flips collapsed() state; second toggle flips back', () => {
      component.reasoning = 'hello';
      component.autoCollapsed = false;
      fixture.detectChanges();
      expect(component.collapsed()).toBe(false);

      component.toggle();
      fixture.detectChanges();
      expect(component.collapsed()).toBe(true);

      component.toggle();
      fixture.detectChanges();
      expect(component.collapsed()).toBe(false);
    });

    it('reasoning body renders only when collapsed() is false', () => {
      component.reasoning = 'visible reasoning';
      component.autoCollapsed = false;
      fixture.detectChanges();

      // Expanded: body present
      let body = fixture.nativeElement.querySelector('div.whitespace-pre-wrap');
      expect(body).not.toBeNull();
      expect(body!.textContent).toContain('visible reasoning');

      // Collapse
      component.toggle();
      fixture.detectChanges();
      body = fixture.nativeElement.querySelector('div.whitespace-pre-wrap');
      expect(body).toBeNull();
    });
  });

  describe('collapsed precedence', () => {
    it('streaming overrides autoCollapsed when no user override', () => {
      component.reasoning = 'r';
      component.streaming = true;
      component.autoCollapsed = true;
      expect(component.collapsed()).toBe(false);
    });

    it('user override beats both streaming and autoCollapsed', () => {
      component.reasoning = 'r';
      component.streaming = true;
      component.autoCollapsed = false;
      component.toggle(); // user collapses while streaming
      expect(component.collapsed()).toBe(true);
    });
  });

  describe('XSS safety', () => {
    it('renders <script> as escaped text, not a real script tag', () => {
      component.reasoning = '<script>alert(1)</script>';
      fixture.detectChanges();
      const body = fixture.nativeElement.querySelector('div.whitespace-pre-wrap') as HTMLElement;
      expect(body).not.toBeNull();
      // Angular escapes via text interpolation: innerHTML must contain the escaped form
      expect(body.innerHTML).not.toContain('<script>');
      expect(body.innerHTML).toContain('&lt;script&gt;');
      // No actual script element was created
      expect(body.querySelector('script')).toBeNull();
    });
  });
});
