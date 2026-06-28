import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DoCheck,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { ChatHistoryItem, ChatMessage, ConversationSession, DinoSkill, DinoSummary, GroupReaction, IMAGE_TOKEN_COST, LeaderboardRow, ReactionLevel, SideThread, StreamEvent, ToolCallRecord, ToolInfo, VoiceProfile, estimateTextTokens, getContextWindow, reactionLabel } from '@org/shared-types';
import { VoiceSynthesisService } from '../voice/voice-synthesis.service.js';
import { VoiceRecognitionService } from '../voice/voice-recognition.service.js';
import { AssistantService } from '../voice/assistant.service.js';
import { SsmlHint } from '../voice/tts-provider.js';
import { DinoPicker, GroupResponse, HistoryPanel, InputComposer, Leaderboard, Mascot, MessageBubble, ReasoningBlock, ReactivitySettings, SkillManager, ToolCallBubble } from '@chatbot/ui';
import { CustomDinoCreator } from './custom-dino-creator';
import { SideThreadComponent } from './side-thread';
import { buildHistory } from './history-builder';
import { ArenaService } from './arena.service';
import { ChatService, newUuid } from './chat.service';
import { DinoService } from './dino.service';
import { GroupchatService } from './groupchat.service';
import { ReactivityService } from './reactivity.service.js';
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

/**
 * Conservative estimate of the tokens consumed by the dino's system prompt.
 * The client never holds the prompt text, so we use a fixed allowance (~800 tokens
 * — typical for a 2-3 paragraph system prompt). Deliberately approximate (D-08).
 */
const SYSTEM_PROMPT_ALLOWANCE = 800;

/** Cap on retained images in context, matching buildHistory() IMAGE_CAP (Phase 32-01). */
const IMAGE_CAP = 2;

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
  imports: [CustomDinoCreator, DinoPicker, GroupResponse, HistoryPanel, InputComposer, Leaderboard, Mascot, MessageBubble, ReasoningBlock, ReactivitySettings, SideThreadComponent, SkillManager, ToolCallBubble],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class ChatComponent implements OnInit, OnDestroy, DoCheck {
  private readonly chatService = inject(ChatService);
  private readonly dinoService = inject(DinoService);
  private readonly skillService = inject(SkillService);
  readonly reactivityService = inject(ReactivityService);
  readonly groupchatService = inject(GroupchatService);
  readonly arenaService = inject(ArenaService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly store = inject(Store);
  /** TTS service — injected here so the template can reference voiceSynth.speaking() etc. */
  readonly voiceSynth = inject(VoiceSynthesisService);
  /** STT service (VOX-03) — drives mic button state and fills composer draft via transcript signal. */
  readonly voiceRec = inject(VoiceRecognitionService);
  /** Voice Dino Assistant (Phase 29) — voice commands → whitelisted app actions. */
  readonly assistant = inject(AssistantService);
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
  /** dinoId → display name lookup, used to attribute group-chat reactions by name. */
  readonly dinoNames = computed<Record<string, string>>(() =>
    Object.fromEntries(this.dinos().map((d) => [d.id, d.name])),
  );
  readonly activeDinoId = this.store.selectSignal(selectActiveDinoId);
  readonly activeDino = this.store.selectSignal(selectActiveDino);

  /** Head avatar of the active dino for the header + assistant message bubbles. */
  readonly activeDinoAvatarSrc = computed(() => {
    const id = this.activeDinoId();
    return id ? `/spino/dinos/avatars/${id}.png` : '/spino/spino-avatar.png';
  });

  // ─── Side threads (drill-down branches) ───
  // Kept as component signals (mirrors the arena/group transient-state pattern) and
  // persisted into the session snapshot via persistActiveSession; the persist effect
  // writes that snapshot to localStorage. Isolation is structural: branch turns live
  // here, never in `messages()`, so buildHistory() for the main thread can't see them.
  readonly sideThreads = signal<SideThread[]>([]);
  /** id of the side thread shown in the drawer, or null when the drawer is closed. */
  readonly activeSideThreadId = signal<string | null>(null);

  readonly activeSideThread = computed<SideThread | undefined>(() =>
    this.sideThreads().find((t) => t.id === this.activeSideThreadId()),
  );

  /** Anchor message ids that have a non-discarded side thread — drives the bubble badge. */
  readonly branchedMessageIds = computed<Set<string>>(
    () =>
      new Set(
        this.sideThreads()
          .filter((t) => t.status !== 'discarded')
          .map((t) => t.anchorMessageId),
      ),
  );

  /**
   * Main-thread context a side thread inherits: every message up to & including the
   * anchored one. The branch dino sees this plus the branch's own turns. Falls back
   * to the whole transcript if the anchor was since removed (e.g. via regenerate).
   */
  readonly activeSideThreadContext = computed<ChatMessage[]>(() => {
    const thread = this.activeSideThread();
    if (!thread) return [];
    const msgs = this.messages();
    const idx = msgs.findIndex((m) => m.id === thread.anchorMessageId);
    return idx === -1 ? msgs : msgs.slice(0, idx + 1);
  });

  isLoading = false;
  /** True for one animation frame during a session switch — covers the message swap so stale bubbles never paint. */
  threadSwitching = false;
  placeholder: string = PLACEHOLDER_EXAMPLES[0];

  private sessionTitle = '';
  private sessionCreatedAt = 0;
  private currentAbort: AbortController | null = null;
  private streamingToolCallIds: string[] = [];
  private readLastMessageSub?: { unsubscribe(): void };
  private sendMessageSub?: { unsubscribe(): void };

  // Arena state (transient selection — out of NgRx scope, kept as signals)
  readonly arenaPrompt = signal('');
  readonly arenaLeaderboard = this.arenaService.leaderboard;
  /** Expose arena panels for the template. */
  readonly arenaPanels = this.arenaService.panels;
  readonly arenaPhase = this.arenaService.phase;

  // Groupchat: set of selected dino IDs (transient selection — out of NgRx scope)
  readonly selectedGroupDinoIds = signal<string[]>([]);
  /** Interleaved attributed group transcript (turn-based — Phase 35). */
  readonly groupchatMessages = this.groupchatService.messages;
  /** True while a group turn is streaming. */
  readonly groupchatStreaming = this.groupchatService.streaming;
  /** Expose cap for template use (static → instance bridge). */
  readonly groupchatMaxDinos = GroupchatService.MAX_DINOS;

  // ─── Context-usage ring (Phase 32 / CTX-03) ────────────────────────────────

  /**
   * Current draft text in the main chat composer, updated via the
   * `(draftChange)` output. Used in the contextUsage estimate so the
   * ring reflects the draft contribution in real time.
   */
  readonly currentDraft = signal('');

  /**
   * Live estimate of next-turn context-window usage, derived from:
   *   - replayed history text (estimateTextTokens per user/assistant item)
   *   - replayed tool results (estimateTextTokens per toolResult)
   *   - retained images (IMAGE_TOKEN_COST × up to IMAGE_CAP images)
   *   - a fixed SYSTEM_PROMPT_ALLOWANCE (client never holds the prompt)
   *   - the current draft (estimateTextTokens)
   *
   * Denominator: getContextWindow(activeDino().model) — real per-model window
   * from @org/shared-types, falling back to DEFAULT_CONTEXT_WINDOW (8000) for
   * unknown models (D-07). All values are approximately computed (D-08).
   * Warn-only at ~80% — nothing is removed (D-09/D-10).
   */
  readonly contextUsage = computed(() => {
    const msgs = this.messages();
    const draft = this.currentDraft();
    const model = this.activeDino()?.model ?? '';

    let tokens = SYSTEM_PROMPT_ALLOWANCE;
    let imageCount = 0;

    // Walk the message list in newest-to-oldest order to apply the IMAGE_CAP.
    // We then iterate oldest-to-newest for the text sum, so collect first.
    const allItems = msgs.slice(0, -1); // exclude the current turn (not yet sent)

    for (let i = allItems.length - 1; i >= 0; i--) {
      const m = allItems[i];
      if (m.role === 'user') {
        tokens += estimateTextTokens(m.text);
        if (m.imageDataUrl && imageCount < IMAGE_CAP) {
          tokens += IMAGE_TOKEN_COST;
          imageCount++;
        }
      } else if (m.role === 'assistant') {
        tokens += estimateTextTokens(m.text);
      } else if (m.role === 'tool' && m.toolResult) {
        tokens += estimateTextTokens(m.toolResult);
      }
    }

    // Add the current draft contribution.
    tokens += estimateTextTokens(draft);

    const window = getContextWindow(model);
    const percent = Math.min(100, Math.round((tokens / window) * 100));

    return { tokens, percent };
  });

  // ─── @mention autocomplete for the group composer (GRP2-02 / D-04) ───
  /** True while the mention dropdown is open. */
  readonly mentionOpen = signal(false);
  /** Participant dinos matching the trailing @<partial> token. */
  readonly mentionCandidates = signal<DinoSummary[]>([]);
  /** Last group-composer draft seen by the mention detector (DoCheck guard). */
  private lastGroupDraft = '';
  readonly knowledgeFiles = signal<KnowledgeFile[]>([]);

  /**
   * Text of the message currently being read aloud.
   * Used to set [speaking] on the active MessageBubble.
   * Cleared when VoiceSynthesisService.speaking() drops to false.
   */
  readonly speakingMessageText = signal<string | null>(null);

  /** Cached selector signal — created once in injection context to avoid per-emission leaks (CR-03). */
  private readonly lastAssistantMessage = this.store.selectSignal(selectLastAssistantMessage);

  constructor() {
    // Voice effects are registered in the constructor (an injection context) rather
    // than in event handlers or ngOnInit, which throw NG0203 (CR-01/CR-02).

    // Clears speakingMessageText when TTS playback ends. Reads only speaking(), so it
    // does not re-fire when onReadAloud sets speakingMessageText — avoids the start race.
    effect(() => {
      if (!this.voiceSynth.speaking()) {
        this.speakingMessageText.set(null);
      }
    });

    // VOX-03: Mirror voice transcript into the composer draft live. Transcript is
    // untrusted: trimmed and capped. Never calls submit() — user reviews and sends (D-08).
    // When the voice assistant (Phase 29) owns the mic, skip mirroring so command
    // speech never lands in the composer.
    effect(() => {
      if (this.assistant.active()) return;
      const raw = this.voiceRec.transcript();
      if (raw && this.inputComposerRef) {
        this.inputComposerRef.draft = raw.trim().slice(0, MAX_DRAFT_LENGTH);
        this.cdr.markForCheck();
      }
    });

    // Persist a completed group turn (D-08 / GRP2-04). When the group stream
    // settles (streaming true → false) and the transcript has ≥1 user message,
    // save the interleaved attributed session through the same store/HistoryService
    // path single chat uses, then refresh the panel. The group session keeps a
    // stable id across turns, so re-saving updates in place (no duplicate entry).
    effect(() => {
      const streaming = this.groupchatStreaming();
      const wasStreaming = this.prevGroupStreaming;
      this.prevGroupStreaming = streaming;
      if (wasStreaming && !streaming) {
        this.persistGroupSession();
      }
    });
  }

  /** Tracks the previous group-streaming value so the persist effect fires on the falling edge. */
  private prevGroupStreaming = false;

  // Transient STREAMING state — intentionally NOT migrated (documented boundary).
  readonly streamingText = signal('');
  readonly streamingReasoning = signal('');
  readonly reasoningCollapsed = signal(false);
  readonly streamingReasoningDurationMs = signal<number | undefined>(undefined);
  readonly streamingError = signal<string | null>(null);
  readonly streamingToolCalls = signal<ToolCallRecord[]>([]);
  /** Image generated by an artist dino this turn (data URL), rendered live then committed. */
  readonly streamingImage = signal<string | null>(null);
  readonly isStreaming = signal(false);
  /** The single taught skill selected by the backend for the current conversation (MEM2-01). Null when no skill was pulled. */
  readonly activeSkill = signal<{ id: string; title: string } | null>(null);

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

  // ─────────────────── Voice Dino Assistant (Phase 29) ─────────────────────

  /**
   * Toggle the voice assistant: start listening for a command, or cancel if
   * already active. Supplies the live app context (past chats, dinos, current
   * view) so the assistant can resolve "switch to my chat about X" (AST-04) and
   * "talk to Rexford" to concrete ids.
   */
  onAssistantToggle(): void {
    if (this.assistant.active()) {
      this.assistant.cancel();
      return;
    }
    this.assistant.start({
      sessions: this.sessions().map((s) => ({ id: s.id, title: s.title })),
      dinos: this.dinos().map((d) => ({ id: d.id, name: d.name })),
      currentView: this.activeView(),
    });
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
    // Note: speakingMessageText is cleared by the field-level speakingClearEffect
    // when the service's speaking() signal drops. Creating an effect() here would
    // throw NG0203 (event handlers are not an injection context) and also race the
    // async utterance.onstart that flips speaking() to true.
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
    if (view === 'knowledge') {
      const dinoId = this.activeDinoId();
      if (dinoId) this.refreshLearned(dinoId);
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

  /** Send the prompt to all selected dinos via the turn-based GroupchatService. */
  onGroupSend(text: string): void {
    const ids = this.selectedGroupDinoIds();
    if (ids.length === 0 || !text.trim()) return;
    this.closeMention();
    this.groupchatService.send(text, ids);
    this.cdr.markForCheck();
  }

  /**
   * Persist the current group transcript (D-08). Title is seeded from the first
   * user message (like single chat). Only persists when the transcript has ≥1
   * user message. Reuses the existing session upsert path (store + HistoryService)
   * and refreshes the panel so the group thread lists alongside single chats.
   */
  private persistGroupSession(): void {
    const messages = this.groupchatMessages();
    const firstUser = messages.find((m) => m.role === 'user');
    if (!firstUser) return;
    const seed = firstUser.text || 'Group chat';
    const title = seed.length > 50 ? seed.slice(0, 50) + '…' : seed;
    this.store.dispatch(
      SessionActions.upsertActiveSession({
        session: this.groupchatService.toSession(title),
      }),
    );
    this.store.dispatch(SessionActions.loadSessions());
    this.cdr.markForCheck();
  }

  /**
   * History-panel selection handler: group threads reopen into the groupchat view
   * (full transcript + roster restored); single chats keep the existing switch path.
   */
  onSessionSelected(session: ConversationSession): void {
    if (session.isGroup) {
      this.openSession(session);
      return;
    }
    this.setActiveView('chats');
    this.switchToSession(session);
    this.closeMobileSidebar();
  }

  /**
   * Reopen a persisted group thread (Success Criterion #4 / GRP2-04): switch to
   * the groupchat view, restore the full attributed transcript + the saved
   * participant roster, and close the mobile sidebar. Single-chat reopen stays on
   * the `switchToSession` path (see chat.html `(sessionSelected)` branch).
   */
  openSession(session: ConversationSession): void {
    this.setActiveView('groupchat');
    this.selectedGroupDinoIds.set(this.groupchatService.loadSession(session));
    this.store.dispatch(UiActions.closeHistory());
    this.closeMobileSidebar();
    this.cdr.markForCheck();
  }

  /** Attributed hover label for a reaction chip — e.g. "Nimbus thought that's brilliant". */
  reactionLabel(reaction: GroupReaction): string {
    return reactionLabel(this.dinoNames()[reaction.dinoId], reaction.emoji);
  }

  /** Retrieve a dino by id for template iteration over groupchat messages. */
  groupDinoById(id: string | undefined): DinoSummary | undefined {
    if (!id) return undefined;
    return this.dinos().find((d) => d.id === id);
  }

  /** The participant dinos resolved to summaries, in selection order. */
  participantDinos(): DinoSummary[] {
    return this.selectedGroupDinoIds()
      .map((id) => this.groupDinoById(id))
      .filter((d): d is DinoSummary => d !== undefined);
  }

  /**
   * @mention detection (D-04): when the group composer draft ends with a
   * `@<partial>` token, open a dropdown of participant dinos whose name matches.
   * Driven from ngDoCheck so it tracks the composer's draft without modifying
   * app-input-composer. Scoped to the groupchat view only.
   */
  private detectMention(draft: string): void {
    const match = draft.match(/(?:^|\s)@([\w-]*)$/);
    if (!match) {
      this.closeMention();
      return;
    }
    const partial = match[1].toLowerCase();
    const candidates = this.participantDinos().filter((d) =>
      d.name.toLowerCase().includes(partial),
    );
    if (candidates.length === 0) {
      this.closeMention();
      return;
    }
    this.mentionCandidates.set(candidates);
    this.mentionOpen.set(true);
  }

  /** Insert `@Name ` into the group composer draft, replacing the trailing token. */
  applyMention(dino: DinoSummary): void {
    const composer = this.groupComposerRef;
    if (!composer) return;
    composer.draft = composer.draft.replace(/(?:^|\s)@([\w-]*)$/, (full) => {
      const lead = full.startsWith('@') ? '' : full[0];
      return `${lead}@${dino.name} `;
    });
    this.lastGroupDraft = composer.draft;
    this.closeMention();
    this.cdr.markForCheck();
  }

  /** Close the mention dropdown and clear candidates. */
  private closeMention(): void {
    if (this.mentionOpen()) this.mentionOpen.set(false);
    if (this.mentionCandidates().length > 0) this.mentionCandidates.set([]);
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

  // ─────────────────── Custom Dino Creator (CDINO-01/CDINO-03) ────────────

  /**
   * When true, the CustomDinoCreator overlay is shown.
   * Named distinctly from skillPanelOpen; method openDinoCreator() avoids
   * collision with the existing openCreator() (D-07).
   */
  readonly dinoCreatorOpen = signal(false);
  /**
   * The dino being edited; undefined = create mode.
   * Set by onEditDino() and cleared when the creator closes.
   */
  readonly editingDino = signal<DinoSummary | undefined>(undefined);

  /** Open the creator in "add a new dino" mode. */
  openDinoCreator(): void {
    this.editingDino.set(undefined);
    this.dinoCreatorOpen.set(true);
  }

  /** Open the creator pre-filled with an existing custom dino. */
  onEditDino(dino: DinoSummary): void {
    this.editingDino.set(dino);
    this.dinoCreatorOpen.set(true);
  }

  /**
   * Confirm + delete a custom dino, then reload the roster (D-07/D-08).
   * Uses window.confirm for the delete prompt (acceptable for this phase).
   */
  onDeleteDino(dino: DinoSummary): void {
    if (!window.confirm(`Delete "${dino.name}"? This cannot be undone.`)) return;
    this.dinoService.deleteCustomDino(dino.id).subscribe({
      next: () => {
        this.store.dispatch(DinoActions.loadDinos());
        this.cdr.markForCheck();
      },
      error: () => this.cdr.markForCheck(),
    });
  }

  /** Called after a successful create or update — close overlay + reload roster. */
  onDinoSaved(): void {
    this.dinoCreatorOpen.set(false);
    this.editingDino.set(undefined);
    this.store.dispatch(DinoActions.loadDinos());
    this.cdr.markForCheck();
  }

  closeDinoCreator(): void {
    this.dinoCreatorOpen.set(false);
    this.editingDino.set(undefined);
    this.cdr.markForCheck();
  }

  // ───────── Teach-a-skill + learned-items management (MEM-04..06) ─────────

  // ─────────────── Reactivity settings panel (Phase 43, GRP3-04) ──────────────

  /**
   * When true the reactivity settings panel is visible alongside the group dino
   * selector. Load levels on open; only write on explicit user change.
   */
  readonly reactivityPanelOpen = signal(false);

  toggleReactivityPanel(): void {
    const opening = !this.reactivityPanelOpen();
    this.reactivityPanelOpen.set(opening);
    if (opening) {
      this.reactivityService.load();
    }
    this.cdr.markForCheck();
  }

  onLevelChanged(event: { dinoId: string; level: ReactionLevel }): void {
    this.reactivityService.setLevel(event.dinoId, event.level);
  }

  /** When true, the teach-a-skill + "what this dino knows" overlay is shown. */
  readonly skillPanelOpen = signal(false);
  readonly skillTitle = signal('');
  /** Editable activation trigger for the 3-field form (Phase 33 column / Phase 34 creator). */
  readonly skillWhenToActivate = signal('');
  readonly skillInstruction = signal('');
  readonly skillSaving = signal(false);
  readonly learnedSkills = signal<DinoSkill[]>([]);
  readonly learnedMemories = signal<{ id: string; content: string }[]>([]);

  // ─────────── AI Memory Creator state (Phase 34, SC#1–SC#3) ───────────
  /** True while suggestions are being generated — drives the dino "thinking" placeholder (D-06). */
  readonly creatorThinking = signal(false);
  /** Conversation-derived suggestions (≥3 on success; empty on error → free-text fallback). */
  readonly creatorSuggestions = signal<string[]>([]);
  /** Free natural-text input the user can synthesize instead of picking a suggestion (D-05). */
  readonly creatorInput = signal('');
  /** True while a pick/free-text choice is being synthesized into the 3-field form. */
  readonly creatorSynthesizing = signal(false);

  openSkillPanel(prefillInstruction?: string): void {
    const dinoId = this.activeDinoId();
    if (!dinoId) return;
    this.skillPanelOpen.set(true);
    if (prefillInstruction) {
      this.skillInstruction.set(prefillInstruction);
    }
    this.refreshLearned(dinoId);
  }

  /**
   * Brain-click entry (D-06): open the overlay, reset creator state, then auto-fire
   * suggestion generation from the current conversation. While it runs the template
   * shows a dino "thinking" placeholder. On error suggestions stay empty (the UI falls
   * back to the free-text input) — a creator failure never blocks the chat (T-34-02-03).
   */
  openCreator(): void {
    const dinoId = this.activeDinoId();
    if (!dinoId) return;
    this.skillPanelOpen.set(true);
    this.resetCreator();
    this.refreshLearned(dinoId);
    const history: ChatHistoryItem[] = this.messages()
      .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } =>
        (m.role === 'user' || m.role === 'assistant') && m.text.trim().length > 0,
      )
      .map((m) => ({ role: m.role, text: m.text }));
    this.creatorThinking.set(true);
    this.skillService.suggest(dinoId, history).subscribe({
      next: (res) => {
        this.creatorSuggestions.set(res.suggestions);
        this.creatorThinking.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.creatorSuggestions.set([]);
        this.creatorThinking.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  /** Pick a generated suggestion → synthesize it into the editable form (D-05). */
  pickSuggestion(suggestion: string): void {
    this.synthesizeInto(suggestion);
  }

  /** Submit the free-text input → synthesize it into the editable form (D-05). */
  submitCreatorInput(): void {
    const input = this.creatorInput().trim();
    if (!input) return;
    this.synthesizeInto(input);
  }

  updateCreatorInput(event: Event): void {
    this.creatorInput.set((event.target as HTMLTextAreaElement).value);
  }

  updateSkillWhenToActivate(event: Event): void {
    this.skillWhenToActivate.set((event.target as HTMLInputElement).value);
  }

  /**
   * Single convergent synthesize step (D-05): both pick-a-suggestion and free-text
   * route here. Prefills the editable name/when/instruction signals; the form stays
   * fully editable before save. On error the form is left as-is.
   */
  private synthesizeInto(input: string): void {
    const dinoId = this.activeDinoId();
    if (!dinoId || this.creatorSynthesizing()) return;
    this.creatorSynthesizing.set(true);
    this.skillService.synthesize(dinoId, input).subscribe({
      next: (skill) => {
        this.skillTitle.set(skill.title);
        this.skillWhenToActivate.set(skill.whenToActivate ?? '');
        this.skillInstruction.set(skill.instruction);
        this.creatorSynthesizing.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.creatorSynthesizing.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  /**
   * Save the synthesized item (D-07): the backend reconciles create-vs-update — the
   * component does NO new-vs-update branching. On success refresh the learned list so
   * the item appears in <app-skill-manager>, then reset the creator + form.
   */
  saveCreated(): void {
    const dinoId = this.activeDinoId();
    const title = this.skillTitle().trim();
    const instruction = this.skillInstruction().trim();
    const whenToActivate = this.skillWhenToActivate().trim();
    if (!dinoId || !title || !instruction || this.skillSaving()) return;
    this.skillSaving.set(true);
    this.skillService
      .saveCreated(dinoId, {
        title,
        instruction,
        ...(whenToActivate ? { whenToActivate } : {}),
      })
      .subscribe({
        next: () => {
          this.refreshLearned(dinoId);
          this.resetCreator();
          this.skillTitle.set('');
          this.skillWhenToActivate.set('');
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

  /** Clear creator-only state (suggestions, input, thinking/synthesizing flags). */
  private resetCreator(): void {
    this.creatorSuggestions.set([]);
    this.creatorInput.set('');
    this.creatorThinking.set(false);
    this.creatorSynthesizing.set(false);
  }

  closeSkillPanel(): void {
    this.skillPanelOpen.set(false);
    this.skillTitle.set('');
    this.skillWhenToActivate.set('');
    this.skillInstruction.set('');
    this.resetCreator();
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

  onSkillEdited(payload: { id: string; title: string; whenToActivate?: string; instruction: string }): void {
    this.skillService.updateSkill(payload.id, { title: payload.title, whenToActivate: payload.whenToActivate, instruction: payload.instruction }).subscribe({
      next: (updated) => {
        this.learnedSkills.update((s) => s.map((x) => x.id === updated.id ? updated : x));
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
  /** Reference to the group-view composer — drives @mention detection (D-04). */
  @ViewChild('groupComposer') private groupComposerRef?: InputComposer;

  /**
   * Watch the group composer's draft each change-detection cycle and run @mention
   * detection when it changes. Guarded by lastGroupDraft so it only re-evaluates
   * on an actual edit. Only the groupchat view renders #groupComposer.
   */
  ngDoCheck(): void {
    const composer = this.groupComposerRef;
    if (!composer) return;
    if (composer.draft !== this.lastGroupDraft) {
      this.lastGroupDraft = composer.draft;
      this.detectMention(composer.draft);
    }
  }

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

    // VOX-03 transcript mirroring runs via the field-level transcriptMirrorEffect.

    // Phase 29 seam: when the voice assistant dispatches read_last_message,
    // resolve the last assistant message and speak it. Reads the cached
    // lastAssistantMessage signal (created once in injection context — CR-03).
    this.readLastMessageSub = this.actions$
      .pipe(ofType('[Assistant] Read Last Message Requested'))
      .subscribe(() => {
        const msg = this.lastAssistantMessage();
        if (msg) {
          this.onReadAloud(msg.text);
        }
      });

    // Phase 29 seam: when the assistant dispatches send_message, run it through
    // the normal send pipeline (ChatComponent owns streaming). AST-01.
    this.sendMessageSub = this.actions$
      .pipe(ofType('[Assistant] Send Message Requested'))
      .subscribe((action) => {
        const text = (action as { text?: string }).text?.trim();
        if (text) this.onSend(text);
      });
  }

  ngOnDestroy(): void {
    if (this.placeholderTimer !== null) {
      clearInterval(this.placeholderTimer);
    }
    this.currentAbort?.abort();
    this.readLastMessageSub?.unsubscribe();
    this.sendMessageSub?.unsubscribe();
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
    this.threadSwitching = true;
    this.cdr.markForCheck();
    this.activeSkill.set(null);
    this.saveCurrentSession();
    this.activeSideThreadId.set(null);
    this.sessionTitle = session.title;
    this.sessionCreatedAt = session.createdAt;
    this.store.dispatch(DinoActions.setActiveDino({ dinoId: session.dinoId }));
    this.chatService.setThread(session.id);
    // Backfill stable ids on legacy messages so side-thread anchoring is reliable.
    const withIds: ConversationSession = {
      ...session,
      messages: session.messages.map((m) => (m.id ? m : { ...m, id: newUuid() })),
    };
    this.sideThreads.set(withIds.sideThreads ?? []);
    this.store.dispatch(SessionActions.switchSession({ session: withIds }));
    this.store.dispatch(UiActions.closeHistory());
    requestAnimationFrame(() => {
      this.threadSwitching = false;
      this.cdr.markForCheck();
    });
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
    this.activeSkill.set(null);
    this.sideThreads.set([]);
    this.activeSideThreadId.set(null);
    this.chatService.resetThread();
    this.store.dispatch(
      SessionActions.newChat({
        sessionId: this.chatService.currentThreadId,
        messages: [{ ...WELCOME_MESSAGE, id: newUuid(), createdAt: Date.now() }],
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
          sideThreads: this.sideThreads(),
        },
      }),
    );
  }

  onSend(text: string, imageDataUrl?: string): void {
    if (this.isLoading || this.isStreaming()) return;
    if (!text && !imageDataUrl) return;

    if (!this.sessionTitle) {
      const seed = text || 'Image';
      this.sessionTitle = seed.length > 50 ? seed.slice(0, 50) + '…' : seed;
      this.sessionCreatedAt = Date.now();
    }

    this.store.dispatch(
      SessionActions.appendMessage({
        message: { id: newUuid(), text, role: 'user', createdAt: Date.now(), imageDataUrl },
      }),
    );
    this.beginRequest();
    this.dispatchRequest(text, imageDataUrl);
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
    this.dispatchRequest(prevUser.text, prevUser.imageDataUrl);
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
        messages: [...truncated, { id: newUuid(), text: newText, role: 'user', createdAt: Date.now() }],
      }),
    );
    this.beginRequest();
    this.dispatchRequest(newText);
  }

  // ─── Side threads (drill-down branches) ───

  /** True while a merge summary is being generated (gates the branch composer). */
  readonly mergeInProgress = signal(false);

  /** Short, single-line preview of a message for the side-thread header / anchor. */
  private previewText(m: ChatMessage): string {
    const t = (m.text || (m.imageDataUrl ? 'Image' : '')).trim().replace(/\s+/g, ' ');
    return t.length > 80 ? t.slice(0, 80) + '…' : t;
  }

  /** Ensure the message at `index` has a stable id, backfilling it into the store. */
  private ensureMessageId(index: number): string {
    const msgs = this.messages();
    const msg = msgs[index];
    if (msg.id) return msg.id;
    const id = newUuid();
    const next = msgs.slice();
    next[index] = { ...msg, id };
    this.store.dispatch(SessionActions.setMessages({ messages: next }));
    return id;
  }

  /** Open (or re-focus) a drill-down side thread anchored to the message at `index`. */
  onDrillIn(index: number): void {
    const msgs = this.messages();
    if (index < 0 || index >= msgs.length) return;
    const anchorId = this.ensureMessageId(index);

    const existing = this.sideThreads().find(
      (t) => t.anchorMessageId === anchorId && t.status !== 'discarded',
    );
    if (existing) {
      this.activeSideThreadId.set(existing.id);
    } else {
      const thread: SideThread = {
        id: newUuid(),
        anchorMessageId: anchorId,
        anchorPreview: this.previewText(msgs[index]),
        messages: [],
        status: 'open',
        createdAt: Date.now(),
      };
      this.sideThreads.update((list) => [...list, thread]);
      this.activeSideThreadId.set(thread.id);
      this.persistActiveSession(this.sessionTitle || 'Untitled', this.sessionCreatedAt || Date.now());
    }
    this.cdr.markForCheck();
  }

  /** Persist a branch's evolving message list (emitted after each branch turn). */
  onBranchMessagesChanged(threadId: string, messages: ChatMessage[]): void {
    this.sideThreads.update((list) =>
      list.map((t) => (t.id === threadId ? { ...t, messages } : t)),
    );
    this.persistActiveSession(this.sessionTitle || 'Untitled', this.sessionCreatedAt || Date.now());
  }

  /** Close the drawer without changing the thread's state. */
  onCloseSideThread(): void {
    this.activeSideThreadId.set(null);
    this.cdr.markForCheck();
  }

  /** Drop a side thread — its turns never reach the main context. */
  onDiscardSideThread(threadId: string): void {
    this.sideThreads.update((list) =>
      list.map((t) => (t.id === threadId ? { ...t, status: 'discarded' as const } : t)),
    );
    this.activeSideThreadId.set(null);
    this.persistActiveSession(this.sessionTitle || 'Untitled', this.sessionCreatedAt || Date.now());
    this.cdr.markForCheck();
  }

  /**
   * Merge a side thread back into the main conversation: summarize it with the
   * dino, append the summary as a `mergeNote` assistant message (now visible to
   * the main agent on the next turn), and mark the thread merged.
   */
  async onMergeSideThread(threadId: string, branchMessages: ChatMessage[]): Promise<void> {
    const thread = this.sideThreads().find((t) => t.id === threadId);
    if (!thread || thread.status !== 'open') return;

    const summary = await this.summarizeBranch(thread, branchMessages);

    this.sideThreads.update((list) =>
      list.map((t) =>
        t.id === threadId
          ? { ...t, status: 'merged' as const, mergeSummary: summary, messages: branchMessages }
          : t,
      ),
    );
    this.store.dispatch(
      SessionActions.appendMessage({
        message: {
          id: newUuid(),
          text: summary,
          role: 'assistant',
          mergeNote: true,
          createdAt: Date.now(),
        },
      }),
    );
    this.activeSideThreadId.set(null);
    this.persistActiveSession(this.sessionTitle || 'Untitled', this.sessionCreatedAt || Date.now());
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  /**
   * Condense a side thread into a 1–2 sentence takeaway via the same dino. Tools
   * are disabled for the summary pass. Never throws — falls back to the branch's
   * last substantive answer so a merge always produces something.
   */
  private async summarizeBranch(thread: SideThread, branchMessages: ChatMessage[]): Promise<string> {
    this.mergeInProgress.set(true);
    this.cdr.markForCheck();
    const controller = new AbortController();
    const history = buildHistory(branchMessages);
    const prompt =
      `The conversation above was a side discussion drilling into this earlier point: "${thread.anchorPreview}". ` +
      'In 1-2 sentences, summarize the key takeaway or conclusion so it can be folded back into the main conversation. ' +
      'Reply with ONLY the summary — no preamble.';
    let out = '';
    try {
      for await (const event of this.chatService.streamMessage(
        prompt,
        this.activeDinoId(),
        controller.signal,
        [],
        history,
      )) {
        if (event.type === 'token') out += event.text;
        else if (event.type === 'done') out = event.response || out;
        else if (event.type === 'error') {
          out = '';
          break;
        }
      }
    } catch {
      out = '';
    } finally {
      this.mergeInProgress.set(false);
      this.cdr.markForCheck();
    }
    const summary = out.trim() || this.fallbackBranchSummary(branchMessages);
    return summary;
  }

  /** Last substantive assistant answer in the branch — used when summarization fails. */
  private fallbackBranchSummary(branchMessages: ChatMessage[]): string {
    for (let i = branchMessages.length - 1; i >= 0; i--) {
      const m = branchMessages[i];
      if (m.role === 'assistant' && m.text.trim().length > 0) return m.text.trim();
    }
    return 'Side discussion merged into the main conversation.';
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

  // Recent prior turns sent so the backend has within-thread context. The current
  // turn is excluded (sent separately as `message`). Delegates to the shared pure
  // buildHistory so the main thread and side threads compose context identically.
  private buildHistory(): ChatHistoryItem[] {
    return buildHistory(this.messages().slice(0, -1));
  }

  private async dispatchRequest(text: string, imageDataUrl?: string): Promise<void> {
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
        imageDataUrl,
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
      case 'image': {
        if (this.isLoading) this.isLoading = false;
        this.streamingImage.set(event.imageDataUrl);
        this.cdr.markForCheck();
        this.scrollToBottom();
        return;
      }
      case 'skill_active': {
        this.activeSkill.set({ id: event.skillId, title: event.skillTitle });
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
    const generatedImage = this.streamingImage();
    const assistantMsg: ChatMessage = {
      id: newUuid(),
      text: response,
      role: 'assistant',
      createdAt: Date.now(),
      ...(generatedImage ? { imageDataUrl: generatedImage } : {}),
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
          message: { id: newUuid(), text: partial + footer, role: 'assistant', createdAt: Date.now() },
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
    this.streamingImage.set(null);
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
