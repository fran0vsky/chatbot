import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { ChatHistoryItem, ChatMessage, ConversationSession, DinoSkill, DinoSummary, LeaderboardRow, StreamEvent, ToolCallRecord, ToolInfo, VoiceProfile } from '@org/shared-types';
import { VoiceSynthesisService } from '../voice/voice-synthesis.service.js';
import { VoiceRecognitionService } from '../voice/voice-recognition.service.js';
import { SsmlHint } from '../voice/tts-provider.js';
import { DinoPicker, GroupResponse, HistoryPanel, InputComposer, Leaderboard, Mascot, MascotPanel, MessageBubble, ReasoningBlock, SkillManager, ToolCallBubble } from '@chatbot/ui';
import { ArenaService } from './arena.service';
import { ChatService } from './chat.service';
import { GroupchatService } from './groupchat.service';
import { SkillService } from './skill.service';
import * as DinoActions from '../store/dino/dino.actions';
import * as SessionActions from '../store/session/session.actions';
import * as UiActions from '../store/ui/ui.actions';
import { ActiveView } from '../store/ui/ui.actions';
import { WELCOME_MESSAGE } from '../store/session/session.reducer';
import {
  selectActiveView,
  selectHistoryOpen,
  selectIsDayMode,
  selectMobileSidebarOpen,
  selectPickerOpen,
} from '../store/ui/ui.selectors';
import {
  selectActiveDino,
  selectActiveDinoId,
  selectRoster,
} from '../store/dino/dino.selectors';
import {
  selectLastAssistantMessage,
  selectMessages,
  selectSessions,
} from '../store/session/session.selectors';

/**
 * Maximum character length for voice-dictated input.
 * Treats the STT transcript as untrusted user input (RESEARCH.md Security Domain V5,
 * plan T-28-03). Aligns with typed-input behaviour — the composer does not impose a
 * hard limit on typed text, so we use a generous but bounded cap here.
 */
const MAX_DRAFT_LENGTH = 10_000;

const PLACEHOLDER_EXAMPLES = [
  'Explain quantum computing in simple terms...',
  'Write a poem about the ocean...',
  'Help me debug a TypeScript error...',
  'Summarize the history of jazz...',
] as const;

const PLACEHOLDER_NEUTRAL = 'Message';

// Text-ish extensions we can safely read as UTF-8 in the browser and stuff
// into the prompt. Binary formats (PDF, docx, images) are not supported here —
// they'd need a parser; for the demo we just flag them as unreadable.
const READABLE_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'csv', 'tsv', 'log', 'yml', 'yaml', 'xml',
  'html', 'htm', 'css', 'scss', 'sass', 'less', 'js', 'jsx', 'ts', 'tsx',
  'mjs', 'cjs', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'cpp',
  'h', 'hpp', 'sh', 'bash', 'zsh', 'sql', 'env', 'ini', 'toml', 'conf',
]);

const MAX_READABLE_BYTES = 2 * 1024 * 1024; // 2 MB cap per file

type KnowledgeStatus = 'ready' | 'unreadable' | 'too-large';

interface KnowledgeFile {
  name: string;
  size: number;
  status: KnowledgeStatus;
  content?: string;
}

@Component({
  standalone: true,
  selector: 'app-chat',
  imports: [DinoPicker, GroupResponse, HistoryPanel, InputComposer, Leaderboard, Mascot, MascotPanel, MessageBubble, ReasoningBlock, SkillManager, ToolCallBubble],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class ChatComponent implements OnInit, OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly skillService = inject(SkillService);
  readonly groupchatService = inject(GroupchatService);
  readonly arenaService = inject(ArenaService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly store = inject(Store);
  /** TTS service — injected here so the template can reference voiceSynth.speaking() etc. */
  readonly voiceSynth = inject(VoiceSynthesisService);
  /** STT service (VOX-03) — drives mic button state and fills composer draft via transcript signal. */
  readonly voiceRec = inject(VoiceRecognitionService);
  private readonly actions$ = inject(Actions);

  // ─── Migrated store-driven state (read via selectors, mutate via dispatch) ───
  /** Active message list — store-driven. Mutated only via dispatched actions. */
  readonly messages = this.store.selectSignal(selectMessages);
  readonly sessions = this.store.selectSignal(selectSessions);
  readonly isDayMode = this.store.selectSignal(selectIsDayMode);
  readonly historyOpen = this.store.selectSignal(selectHistoryOpen);
  readonly mobileSidebarOpen = this.store.selectSignal(selectMobileSidebarOpen);
  readonly activeView = this.store.selectSignal(selectActiveView);
  readonly pickerOpen = this.store.selectSignal(selectPickerOpen);
  readonly dinos = this.store.selectSignal(selectRoster);
  readonly activeDinoId = this.store.selectSignal(selectActiveDinoId);
  readonly activeDino = this.store.selectSignal(selectActiveDino);

  isLoading = false;
  placeholder: string = PLACEHOLDER_EXAMPLES[0];

  private sessionTitle = '';
  private sessionCreatedAt = 0;
  private currentAbort: AbortController | null = null;
  private streamingToolCallIds: string[] = [];
  private readLastMessageSub?: { unsubscribe(): void };

  // Arena state (transient selection — out of NgRx scope, kept as signals)
  readonly arenaPrompt = signal('');
  readonly arenaLeaderboard = this.arenaService.leaderboard;
  /** Expose arena panels for the template. */
  readonly arenaPanels = this.arenaService.panels;
  readonly arenaPhase = this.arenaService.phase;

  // Groupchat: set of selected dino IDs (transient selection — out of NgRx scope)
  readonly selectedGroupDinoIds = signal<string[]>([]);
  readonly groupchatEntries = this.groupchatService.entries;
  /** Expose cap for template use (static → instance bridge). */
  readonly groupchatMaxDinos = GroupchatService.MAX_DINOS;
  readonly knowledgeFiles = signal<KnowledgeFile[]>([]);

  /**
   * Text of the message currently being read aloud.
   * Used to set [speaking] on the active MessageBubble.
   * Cleared when VoiceSynthesisService.speaking() drops to false.
   */
  readonly speakingMessageText = signal<string | null>(null);

  // Transient STREAMING state — intentionally NOT migrated (documented boundary).
  readonly streamingText = signal('');
  readonly streamingReasoning = signal('');
  readonly reasoningCollapsed = signal(false);
  readonly streamingReasoningDurationMs = signal<number | undefined>(undefined);
  readonly streamingError = signal<string | null>(null);
  readonly streamingToolCalls = signal<ToolCallRecord[]>([]);
  readonly isStreaming = signal(false);

  // Tool catalog must mirror the names registered in
  // apps/backend/src/app/agents/tools/index.ts. Backend filters by name.
  readonly availableTools: readonly ToolInfo[] = [
    {
      name: 'get_current_time',
      label: 'Current time',
      description: 'Lets Spino fetch the current UTC date and time.',
    },
    {
      name: 'web_search',
      label: 'Web search',
      description: 'DuckDuckGo instant-answer for fresh facts and recent events.',
    },
    {
      name: 'fetch_page',
      label: 'Fetch page',
      description: 'Reads a URL and lets Spino summarise its contents.',
    },
  ];

  readonly enabledToolNames = signal<string[]>(this.availableTools.map((t) => t.name));

  toggleTool(name: string, enabled: boolean): void {
    this.enabledToolNames.update((current) =>
      enabled ? [...new Set([...current, name])] : current.filter((n) => n !== name),
    );
  }

  readonly suggestionPrompts = [
    { icon: '💡', text: 'Explain quantum computing in simple terms' },
    { icon: '✍️', text: 'Write a short poem about the ocean' },
    { icon: '🐛', text: 'Help me debug a TypeScript error' },
    { icon: '📚', text: 'Summarize the history of jazz' },
  ];

  usePrompt(text: string): void {
    if (this.isLoading || this.isStreaming()) return;
    this.onSend(text);
  }

  // ─────────────────── Voice STT handlers (VOX-03) ────────────────────────

  /**
   * Toggle dictation: start if idle, stop if listening.
   * Called when InputComposer emits (micToggle).
   */
  onMicToggle(): void {
    if (this.voiceRec.listening()) {
      this.voiceRec.stop();
    } else {
      this.voiceRec.start();
    }
  }

  // ─────────────────── Voice TTS handlers (VOX-01/VOX-02) ──────────────────

  /**
   * Called when a MessageBubble emits (readAloud).
   * Builds an SsmlHint from the active dino's voiceProfile and speaks the text.
   * Clears speakingMessageText when the service's speaking signal drops.
   */
  onReadAloud(text: string): void {
    const dino = this.activeDino();
    const hint = this.buildSsmlHint(dino?.voiceProfile);
    this.speakingMessageText.set(text);
    this.voiceSynth.speak(text, hint);

    // Clear the tracked text when speech ends (reactive on speaking signal).
    // effect() in a constructor/init context — registered here via a local effect.
    const stopEffect = effect(() => {
      if (!this.voiceSynth.speaking()) {
        this.speakingMessageText.set(null);
        stopEffect.destroy();
      }
    });
  }

  /** Build SsmlHint from an optional VoiceProfile. Returns undefined when no profile. */
  private buildSsmlHint(profile?: VoiceProfile): SsmlHint | undefined {
    if (!profile) return undefined;
    const hint: SsmlHint = {};
    if (profile.rate !== undefined) hint.rate = profile.rate;
    if (profile.pitch !== undefined) hint.pitch = profile.pitch;
    if (profile.preferredVoice !== undefined) hint.preferredVoice = profile.preferredVoice;
    return Object.keys(hint).length > 0 ? hint : undefined;
  }

  toggleMobileSidebar(): void {
    this.store.dispatch(UiActions.toggleMobileSidebar());
  }

  closeMobileSidebar(): void {
    this.store.dispatch(UiActions.closeMobileSidebar());
  }

  setActiveView(view: ActiveView): void {
    this.store.dispatch(UiActions.setActiveView({ view }));
    if (view === 'leaderboard') {
      this.arenaService.loadLeaderboard().then(() => this.cdr.markForCheck());
    }
  }

  /** Toggle a dino in/out of the groupchat selection (cap: GroupchatService.MAX_DINOS). */
  toggleGroupDino(dinoId: string): void {
    this.selectedGroupDinoIds.update((current) => {
      if (current.includes(dinoId)) {
        return current.filter((id) => id !== dinoId);
      }
      if (current.length >= GroupchatService.MAX_DINOS) return current;
      return [...current, dinoId];
    });
  }

  /** Send the prompt to all selected dinos via GroupchatService. */
  onGroupSend(text: string): void {
    const ids = this.selectedGroupDinoIds();
    if (ids.length === 0 || !text.trim()) return;
    this.groupchatService.send(text, ids);
    this.cdr.markForCheck();
  }

  /** Retrieve a dino by id for template iteration over groupchat entries. */
  groupDinoById(id: string): DinoSummary | undefined {
    return this.dinos().find((d) => d.id === id);
  }

  // ─────────────────────────── Arena methods ────────────────────────────────

  updateArenaPrompt(event: Event): void {
    this.arenaPrompt.set((event.target as HTMLTextAreaElement).value);
  }

  onArenaStart(): void {
    const prompt = this.arenaPrompt().trim();
    if (!prompt) return;
    this.arenaService.startBattle(prompt).then(() => this.cdr.markForCheck());
  }

  onArenaVote(result: 'a' | 'b' | 'draw'): void {
    const panels = this.arenaPanels();
    const a = panels.find((p) => p.panel === 'a');
    const b = panels.find((p) => p.panel === 'b');
    if (!a || !b) return;
    this.arenaService.vote(a.dinoId, b.dinoId, result).then(() => this.cdr.markForCheck());
  }

  onArenaNext(): void {
    this.arenaPrompt.set('');
    this.arenaService.reset();
    this.cdr.markForCheck();
  }

  /** Look up a dino by id for template use (used in arena reveal). */
  dinoById(id: string): DinoSummary | undefined {
    return this.dinos().find((d) => d.id === id);
  }

  /** Cast LeaderboardRow[] for the Leaderboard component input. */
  leaderboardRows(): LeaderboardRow[] {
    return this.arenaLeaderboard();
  }

  /** Choosing a dino (from the picker or Explore) starts a fresh chat bound to it. */
  pickDino(dino: DinoSummary): void {
    this.saveCurrentSession();
    this.store.dispatch(DinoActions.setActiveDino({ dinoId: dino.id }));
    this.store.dispatch(UiActions.closePicker());
    this.startNewChat();
    this.store.dispatch(UiActions.setActiveView({ view: 'chats' }));
  }

  closePicker(): void {
    this.store.dispatch(UiActions.closePicker());
    this.cdr.markForCheck();
  }

  // ───────── Teach-a-skill + learned-items management (MEM-04..06) ─────────

  /** When true, the teach-a-skill + "what this dino knows" overlay is shown. */
  readonly skillPanelOpen = signal(false);
  readonly skillTitle = signal('');
  readonly skillInstruction = signal('');
  readonly skillSaving = signal(false);
  readonly learnedSkills = signal<DinoSkill[]>([]);
  readonly learnedMemories = signal<{ id: string; content: string }[]>([]);

  openSkillPanel(): void {
    const dinoId = this.activeDinoId();
    if (!dinoId) return;
    this.skillPanelOpen.set(true);
    this.refreshLearned(dinoId);
  }

  closeSkillPanel(): void {
    this.skillPanelOpen.set(false);
    this.skillTitle.set('');
    this.skillInstruction.set('');
    this.cdr.markForCheck();
  }

  private refreshLearned(dinoId: string): void {
    this.skillService.getLearned(dinoId).subscribe({
      next: (items) => {
        this.learnedSkills.set(items.skills);
        this.learnedMemories.set(items.memories);
        this.cdr.markForCheck();
      },
      error: () => {
        // Graceful degradation (e.g. DB disabled): show an empty manager.
        this.learnedSkills.set([]);
        this.learnedMemories.set([]);
        this.cdr.markForCheck();
      },
    });
  }

  updateSkillTitle(event: Event): void {
    this.skillTitle.set((event.target as HTMLInputElement).value);
  }

  updateSkillInstruction(event: Event): void {
    this.skillInstruction.set((event.target as HTMLTextAreaElement).value);
  }

  saveSkill(): void {
    const dinoId = this.activeDinoId();
    const title = this.skillTitle().trim();
    const instruction = this.skillInstruction().trim();
    if (!dinoId || !title || !instruction || this.skillSaving()) return;
    this.skillSaving.set(true);
    this.skillService.addSkill(dinoId, title, instruction).subscribe({
      next: (skill) => {
        this.learnedSkills.update((s) => [skill, ...s]);
        this.skillTitle.set('');
        this.skillInstruction.set('');
        this.skillSaving.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.skillSaving.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  onSkillDeleted(id: string): void {
    this.skillService.deleteSkill(id).subscribe({
      next: () => {
        this.learnedSkills.update((s) => s.filter((x) => x.id !== id));
        this.cdr.markForCheck();
      },
      error: () => this.cdr.markForCheck(),
    });
  }

  onMemoryDeleted(id: string): void {
    this.skillService.deleteMemory(id).subscribe({
      next: () => {
        this.learnedMemories.update((m) => m.filter((x) => x.id !== id));
        this.cdr.markForCheck();
      },
      error: () => this.cdr.markForCheck(),
    });
  }

  onKnowledgeFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const list = input.files;
    if (!list) return;
    for (const file of Array.from(list)) {
      this.ingestKnowledgeFile(file);
    }
    input.value = '';
  }

  removeKnowledgeFile(name: string): void {
    this.knowledgeFiles.update((files) => files.filter((f) => f.name !== name));
  }

  private ingestKnowledgeFile(file: File): void {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const readable = READABLE_EXTENSIONS.has(ext);
    if (!readable) {
      this.knowledgeFiles.update((prev) => [
        ...prev,
        { name: file.name, size: file.size, status: 'unreadable' },
      ]);
      this.cdr.markForCheck();
      return;
    }
    if (file.size > MAX_READABLE_BYTES) {
      this.knowledgeFiles.update((prev) => [
        ...prev,
        { name: file.name, size: file.size, status: 'too-large' },
      ]);
      this.cdr.markForCheck();
      return;
    }
    file
      .text()
      .then((content) => {
        this.knowledgeFiles.update((prev) => [
          ...prev,
          { name: file.name, size: file.size, status: 'ready', content },
        ]);
        this.cdr.markForCheck();
      })
      .catch(() => {
        this.knowledgeFiles.update((prev) => [
          ...prev,
          { name: file.name, size: file.size, status: 'unreadable' },
        ]);
        this.cdr.markForCheck();
      });
  }

  private buildKnowledgePrefix(): string {
    const ready = this.knowledgeFiles().filter((f) => f.status === 'ready' && f.content);
    if (ready.length === 0) return '';
    const blocks = ready
      .map((f) => `--- ${f.name} ---\n${f.content}\n--- end of ${f.name} ---`)
      .join('\n\n');
    const names = ready.map((f) => f.name).join(', ');
    return (
      `The user has attached the following reference document(s): ${names}. ` +
      `Use them as context for the question that follows.\n\n${blocks}\n\nUser question: `
    );
  }

  showDateDivider(index: number): boolean {
    const msgs = this.messages();
    const msg = msgs[index];
    if (!msg?.createdAt) return false;
    if (index === 0) return true;
    const prev = msgs[index - 1];
    if (!prev?.createdAt) return true;
    return new Date(msg.createdAt).toDateString() !== new Date(prev.createdAt).toDateString();
  }

  dateDividerLabel(index: number): string {
    const ts = this.messages()[index]?.createdAt;
    if (!ts) return '';
    const date = new Date(ts);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  @ViewChild('messageEnd') private messageEnd?: ElementRef<HTMLElement>;
  /** Reference to the main chat InputComposer for filling draft from STT transcript. */
  @ViewChild(InputComposer) private inputComposerRef?: InputComposer;

  private placeholderIndex = 0;
  private placeholderTimer: ReturnType<typeof setInterval> | null = null;

  get activeSessionId(): string {
    return this.chatService.currentThreadId;
  }

  ngOnInit(): void {
    // Theme hydration + DOM application now flows through the UI effect.
    this.store.dispatch(UiActions.initUi());
    this.store.dispatch(DinoActions.loadDinos());
    this.store.dispatch(SessionActions.loadSessions());
    // Seed activeSessionId with the current ChatService thread id.
    this.store.dispatch(
      SessionActions.setActiveSessionId({ id: this.chatService.currentThreadId }),
    );
    this.placeholderTimer = setInterval(() => {
      this.placeholderIndex = (this.placeholderIndex + 1) % PLACEHOLDER_EXAMPLES.length;
      this.placeholder = PLACEHOLDER_EXAMPLES[this.placeholderIndex];
      this.cdr.markForCheck();
    }, 3000);

    // VOX-03: Mirror voice transcript into the composer draft live.
    // The effect runs on every signal read of voiceRec.transcript().
    // - Transcript is treated as untrusted: trimmed and capped to MAX_DRAFT_LENGTH.
    // - Never calls submit() — the user reviews and sends manually (D-08).
    effect(() => {
      const raw = this.voiceRec.transcript();
      if (raw && this.inputComposerRef) {
        // Sanitize: trim whitespace + enforce max-length cap (T-28-03 / V5)
        this.inputComposerRef.draft = raw.trim().slice(0, MAX_DRAFT_LENGTH);
        this.cdr.markForCheck();
      }
    });

    // Phase 29 seam: when the voice assistant dispatches read_last_message,
    // resolve the last assistant message and speak it.
    this.readLastMessageSub = this.actions$
      .pipe(ofType('[Assistant] Read Last Message Requested'))
      .subscribe(() => {
        const msg = this.store.selectSignal(selectLastAssistantMessage)();
        if (msg) {
          this.onReadAloud(msg.text);
        }
      });
  }

  ngOnDestroy(): void {
    if (this.placeholderTimer !== null) {
      clearInterval(this.placeholderTimer);
    }
    this.currentAbort?.abort();
    this.readLastMessageSub?.unsubscribe();
    // Stop any in-progress TTS when the component is destroyed.
    this.voiceSynth.stop();
  }

  onStop(): void {
    if (!this.isStreaming() && !this.isLoading) return;
    this.currentAbort?.abort();
    this.currentAbort = null;
    const partial = this.streamingText();
    for (const call of this.streamingToolCalls()) {
      this.store.dispatch(
        SessionActions.appendMessage({
          message: {
            text: '',
            role: 'tool',
            toolName: call.name,
            toolArgs: call.args,
            toolResult: call.result,
            createdAt: Date.now(),
          },
        }),
      );
    }
    if (partial.length > 0) {
      const partialReasoning = this.streamingReasoning();
      this.store.dispatch(
        SessionActions.appendMessage({
          message: {
            text: partial,
            role: 'assistant',
            createdAt: Date.now(),
            ...(partialReasoning.length > 0 ? { reasoning: partialReasoning } : {}),
          },
        }),
      );
    }
    this.clearStreaming();
    this.isLoading = false;
    this.persistActiveSession(this.sessionTitle || 'Untitled', this.sessionCreatedAt || Date.now());
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  toggleTheme(): void {
    this.store.dispatch(UiActions.toggleTheme());
  }

  toggleHistory(): void {
    this.store.dispatch(UiActions.toggleHistory());
  }

  closeHistory(): void {
    this.store.dispatch(UiActions.closeHistory());
  }

  switchToSession(session: ConversationSession): void {
    this.saveCurrentSession();
    this.sessionTitle = session.title;
    this.sessionCreatedAt = session.createdAt;
    this.store.dispatch(DinoActions.setActiveDino({ dinoId: session.dinoId }));
    this.chatService.setThread(session.id);
    this.store.dispatch(SessionActions.switchSession({ session }));
    this.store.dispatch(UiActions.closeHistory());
    this.cdr.detectChanges();
  }

  deleteSession(id: string): void {
    const wasActive = this.chatService.currentThreadId === id;
    this.store.dispatch(SessionActions.deleteSession({ id }));
    if (wasActive) {
      this.startNewChat();
    }
    this.cdr.markForCheck();
  }

  renameSession(id: string, title: string): void {
    const trimmed = title.trim();
    if (trimmed.length === 0) return;
    this.store.dispatch(SessionActions.renameSession({ id, title: trimmed }));
    if (this.chatService.currentThreadId === id) {
      this.sessionTitle = trimmed;
    }
    this.cdr.markForCheck();
  }

  togglePinSession(id: string): void {
    this.store.dispatch(SessionActions.togglePin({ id }));
    this.cdr.markForCheck();
  }

  newChat(): void {
    this.saveCurrentSession();
    // Starting a new chat presents the dino picker first (PICK-01).
    this.store.dispatch(UiActions.openPicker());
    this.cdr.markForCheck();
  }

  private startNewChat(): void {
    this.sessionTitle = '';
    this.sessionCreatedAt = 0;
    this.chatService.resetThread();
    this.store.dispatch(
      SessionActions.newChat({
        sessionId: this.chatService.currentThreadId,
        messages: [{ ...WELCOME_MESSAGE, createdAt: Date.now() }],
      }),
    );
    this.store.dispatch(UiActions.closeHistory());
    this.cdr.detectChanges();
  }

  private saveCurrentSession(): void {
    if (!this.messages().some((m) => m.role === 'user')) return;
    this.persistActiveSession(this.sessionTitle || 'Untitled', this.sessionCreatedAt || Date.now());
  }

  /** Dispatch an upsert of the active session (store + HistoryService persistence). */
  private persistActiveSession(title: string, createdAt: number): void {
    this.store.dispatch(
      SessionActions.upsertActiveSession({
        session: {
          id: this.chatService.currentThreadId,
          title,
          messages: [...this.messages()],
          createdAt,
          dinoId: this.activeDinoId(),
        },
      }),
    );
  }

  onSend(text: string): void {
    if (this.isLoading || this.isStreaming()) return;

    if (!this.sessionTitle) {
      this.sessionTitle = text.length > 50 ? text.slice(0, 50) + '…' : text;
      this.sessionCreatedAt = Date.now();
    }

    this.store.dispatch(
      SessionActions.appendMessage({
        message: { text, role: 'user', createdAt: Date.now() },
      }),
    );
    this.beginRequest();
    this.dispatchRequest(text);
  }

  onRegenerate(index: number): void {
    if (this.isLoading || this.isStreaming()) return;
    const msgs = this.messages();
    if (index <= 0 || index >= msgs.length) return;
    const target = msgs[index];
    if (target.role !== 'assistant') return;
    const prevUser = msgs[index - 1];
    if (!prevUser || prevUser.role !== 'user') return;

    this.store.dispatch(
      SessionActions.setMessages({ messages: msgs.slice(0, index) }),
    );
    this.beginRequest();
    this.dispatchRequest(prevUser.text);
  }

  onEditAndResend(index: number, newText: string): void {
    if (this.isLoading || this.isStreaming()) return;
    const msgs = this.messages();
    const target = msgs[index];
    if (!target || target.role !== 'user') return;

    this.saveCurrentSession();

    const truncated = msgs.slice(0, index);
    this.chatService.resetThread();
    this.store.dispatch(
      SessionActions.setActiveSessionId({ id: this.chatService.currentThreadId }),
    );
    this.sessionTitle = newText.length > 50 ? newText.slice(0, 50) + '…' : newText;
    this.sessionCreatedAt = Date.now();
    this.store.dispatch(
      SessionActions.setMessages({
        messages: [...truncated, { text: newText, role: 'user', createdAt: Date.now() }],
      }),
    );
    this.beginRequest();
    this.dispatchRequest(newText);
  }

  private beginRequest(): void {
    this.isLoading = true;
    this.placeholder = PLACEHOLDER_NEUTRAL;
    if (this.placeholderTimer !== null) {
      clearInterval(this.placeholderTimer);
      this.placeholderTimer = null;
    }
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  // Recent prior turns (user/assistant only) sent so the backend has within-thread
  // context. The current turn's user message is already the last entry in
  // the message list, so it is excluded here; the backend receives it as `message`.
  private buildHistory(): ChatHistoryItem[] {
    const HISTORY_CAP = 20;
    return this.messages()
      .slice(0, -1)
      .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } =>
        (m.role === 'user' || m.role === 'assistant') && m.text.trim().length > 0,
      )
      .map((m) => ({ role: m.role, text: m.text }))
      .slice(-HISTORY_CAP);
  }

  private async dispatchRequest(text: string): Promise<void> {
    this.currentAbort?.abort();
    const controller = new AbortController();
    this.currentAbort = controller;

    this.streamingText.set('');
    this.streamingError.set(null);
    this.streamingToolCalls.set([]);
    this.streamingToolCallIds = [];
    this.isStreaming.set(true);

    // Stuff any client-side readable knowledge files into the prompt as context.
    // Not RAG — just prompt-stuffing — but enough for short docs in the demo.
    const augmented = this.buildKnowledgePrefix() + text;

    try {
      for await (const event of this.chatService.streamMessage(
        augmented,
        this.activeDinoId(),
        controller.signal,
        this.enabledToolNames(),
        this.buildHistory(),
      )) {
        this.handleStreamEvent(event);
      }
    } catch {
      // service swallows AbortError; any other throw becomes a generic error event already
    } finally {
      if (this.currentAbort === controller) this.currentAbort = null;
    }
  }

  private handleStreamEvent(event: StreamEvent): void {
    switch (event.type) {
      case 'reasoning_token': {
        if (this.isLoading) this.isLoading = false;
        this.streamingReasoning.update((s) => s + event.text);
        this.cdr.markForCheck();
        return;
      }
      case 'token': {
        if (this.isLoading) {
          this.isLoading = false;
        }
        if (this.streamingReasoning().length > 0 && !this.reasoningCollapsed()) {
          this.reasoningCollapsed.set(true);
        }
        this.streamingText.update((s) => s + event.text);
        this.cdr.markForCheck();
        this.scrollToBottom();
        return;
      }
      case 'tool_call_start': {
        this.streamingToolCallIds.push(event.id);
        this.streamingToolCalls.update((arr) => [
          ...arr,
          { name: event.name, args: event.args, result: '' },
        ]);
        this.cdr.markForCheck();
        this.scrollToBottom();
        return;
      }
      case 'tool_call_result': {
        const idx = this.streamingToolCallIds.indexOf(event.id);
        if (idx === -1) return;
        this.streamingToolCalls.update((arr) => {
          const next = arr.slice();
          next[idx] = { ...next[idx], result: event.result };
          return next;
        });
        this.cdr.markForCheck();
        return;
      }
      case 'done': {
        this.commitTurn(event.response, event.toolCalls ?? [], event.reasoning, event.reasoningDurationMs);
        return;
      }
      case 'error': {
        this.commitErrorTurn(event.message, event.link);
        return;
      }
    }
  }

  private commitTurn(
    response: string,
    toolCalls: ToolCallRecord[],
    reasoning?: string,
    reasoningDurationMs?: number,
  ): void {
    for (const call of toolCalls) {
      this.store.dispatch(
        SessionActions.appendMessage({
          message: {
            text: '',
            role: 'tool',
            toolName: call.name,
            toolArgs: call.args,
            toolResult: call.result,
            createdAt: Date.now(),
          },
        }),
      );
    }
    const assistantMsg: ChatMessage = {
      text: response,
      role: 'assistant',
      createdAt: Date.now(),
      ...(reasoning ? { reasoning } : {}),
      ...(reasoningDurationMs !== undefined ? { reasoningDurationMs } : {}),
    };
    this.store.dispatch(SessionActions.appendMessage({ message: assistantMsg }));
    this.clearStreaming();
    this.finishRequest();
  }

  private commitErrorTurn(message: string, link?: string): void {
    const partial = this.streamingText();
    if (partial.length > 0) {
      for (const call of this.streamingToolCalls()) {
        this.store.dispatch(
          SessionActions.appendMessage({
            message: {
              text: '',
              role: 'tool',
              toolName: call.name,
              toolArgs: call.args,
              toolResult: call.result,
              createdAt: Date.now(),
            },
          }),
        );
      }
      const footer = link
        ? `\n\n_Response interrupted: ${message}_ ([details](${link}))`
        : `\n\n_Response interrupted: ${message}_`;
      this.store.dispatch(
        SessionActions.appendMessage({
          message: { text: partial + footer, role: 'assistant', createdAt: Date.now() },
        }),
      );
    } else {
      const linkPart = link ? `\n\n[View model on OpenRouter](${link})` : '';
      this.store.dispatch(
        SessionActions.appendMessage({
          message: { text: message + linkPart, role: 'error', createdAt: Date.now() },
        }),
      );
    }
    this.clearStreaming();
    this.finishRequest();
  }

  private clearStreaming(): void {
    this.streamingText.set('');
    this.streamingReasoning.set('');
    this.reasoningCollapsed.set(false);
    this.streamingReasoningDurationMs.set(undefined);
    this.streamingError.set(null);
    this.streamingToolCalls.set([]);
    this.streamingToolCallIds = [];
    this.isStreaming.set(false);
  }

  private finishRequest(): void {
    this.isLoading = false;
    this.persistActiveSession(this.sessionTitle, this.sessionCreatedAt);
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    setTimeout(() => this.messageEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 0);
  }
}
