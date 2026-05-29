import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ChatHistoryItem, ChatMessage, ConversationSession, DinoSkill, DinoSummary, StreamEvent, ToolCallRecord, ToolInfo } from '@org/shared-types';
import { DinoPicker, HistoryPanel, InputComposer, Mascot, MascotPanel, MessageBubble, ReasoningBlock, SkillManager, ToolCallBubble } from '@chatbot/ui';
import { ChatService } from './chat.service';
import { DinoService } from './dino.service';
import { HistoryService } from './history.service';
import { SkillService } from './skill.service';

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
  imports: [DinoPicker, HistoryPanel, InputComposer, Mascot, MascotPanel, MessageBubble, ReasoningBlock, SkillManager, ToolCallBubble],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class ChatComponent implements OnInit, OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly historyService = inject(HistoryService);
  private readonly dinoService = inject(DinoService);
  private readonly skillService = inject(SkillService);
  private readonly cdr = inject(ChangeDetectorRef);

  messages: ChatMessage[] = [{ text: 'Welcome to SpinoChat — the AI that survived. What can I help you with?', role: 'assistant', createdAt: Date.now() }];
  isLoading = false;
  placeholder: string = PLACEHOLDER_EXAMPLES[0];
  isDayMode = false;
  historyOpen = false;
  sessions: ConversationSession[] = [];

  private sessionTitle = '';
  private sessionCreatedAt = 0;
  private currentAbort: AbortController | null = null;
  private streamingToolCallIds: string[] = [];

  readonly mobileSidebarOpen = signal(false);
  readonly activeView = signal<'chats' | 'explore' | 'knowledge'>('chats');
  readonly knowledgeFiles = signal<KnowledgeFile[]>([]);
  readonly streamingText = signal('');
  readonly streamingReasoning = signal('');
  readonly reasoningCollapsed = signal(false);
  readonly streamingReasoningDurationMs = signal<number | undefined>(undefined);
  readonly streamingError = signal<string | null>(null);
  readonly streamingToolCalls = signal<ToolCallRecord[]>([]);
  readonly isStreaming = signal(false);

  // The dino roster (model + persona + toolset) is owned by the backend; the
  // client only holds the safe DinoSummary projection and sends a dinoId.
  readonly dinos = this.dinoService.dinos;
  readonly activeDinoId = signal<string | undefined>(undefined);
  readonly activeDino = computed<DinoSummary | undefined>(() =>
    this.dinoService.getById(this.activeDinoId()),
  );
  /** When true, the dino picker overlay is shown (e.g. starting a new chat). */
  readonly pickerOpen = signal(false);

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

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update((v) => !v);
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  setActiveView(view: 'chats' | 'explore' | 'knowledge'): void {
    this.activeView.set(view);
    this.closeMobileSidebar();
  }

  /** Choosing a dino (from the picker or Explore) starts a fresh chat bound to it. */
  pickDino(dino: DinoSummary): void {
    this.saveCurrentSession();
    this.activeDinoId.set(dino.id);
    this.pickerOpen.set(false);
    this.startNewChat();
    this.activeView.set('chats');
  }

  closePicker(): void {
    this.pickerOpen.set(false);
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
    const msg = this.messages[index];
    if (!msg?.createdAt) return false;
    if (index === 0) return true;
    const prev = this.messages[index - 1];
    if (!prev?.createdAt) return true;
    return new Date(msg.createdAt).toDateString() !== new Date(prev.createdAt).toDateString();
  }

  dateDividerLabel(index: number): string {
    const ts = this.messages[index]?.createdAt;
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

  private placeholderIndex = 0;
  private placeholderTimer: ReturnType<typeof setInterval> | null = null;

  get activeSessionId(): string {
    return this.chatService.currentThreadId;
  }

  ngOnInit(): void {
    const saved = localStorage.getItem('desert-theme') as 'day' | 'night' | null;
    this.applyTheme(saved === 'day' ? 'day' : 'night');
    this.dinoService.loadDinos();
    this.sessions = this.historyService.loadSessions();
    this.placeholderTimer = setInterval(() => {
      this.placeholderIndex = (this.placeholderIndex + 1) % PLACEHOLDER_EXAMPLES.length;
      this.placeholder = PLACEHOLDER_EXAMPLES[this.placeholderIndex];
      this.cdr.markForCheck();
    }, 3000);
  }

  ngOnDestroy(): void {
    if (this.placeholderTimer !== null) {
      clearInterval(this.placeholderTimer);
    }
    this.currentAbort?.abort();
  }

  onStop(): void {
    if (!this.isStreaming() && !this.isLoading) return;
    this.currentAbort?.abort();
    this.currentAbort = null;
    const partial = this.streamingText();
    for (const call of this.streamingToolCalls()) {
      this.messages.push({
        text: '',
        role: 'tool',
        toolName: call.name,
        toolArgs: call.args,
        toolResult: call.result,
        createdAt: Date.now(),
      });
    }
    if (partial.length > 0) {
      const partialReasoning = this.streamingReasoning();
      this.messages.push({
        text: partial,
        role: 'assistant',
        createdAt: Date.now(),
        ...(partialReasoning.length > 0 ? { reasoning: partialReasoning } : {}),
      });
    }
    this.clearStreaming();
    this.isLoading = false;
    this.sessions = this.historyService.upsertSession({
      id: this.chatService.currentThreadId,
      title: this.sessionTitle || 'Untitled',
      messages: [...this.messages],
      createdAt: this.sessionCreatedAt || Date.now(),
      dinoId: this.activeDinoId(),
    });
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private applyTheme(mode: 'day' | 'night'): void {
    this.isDayMode = mode === 'day';
    document.documentElement.classList.remove('day-mode', 'night-mode');
    document.documentElement.classList.add(mode === 'day' ? 'day-mode' : 'night-mode');
    this.cdr.markForCheck();
  }

  toggleTheme(): void {
    const next = this.isDayMode ? 'night' : 'day';
    localStorage.setItem('desert-theme', next);
    this.applyTheme(next);
  }

  toggleHistory(): void {
    this.historyOpen = !this.historyOpen;
    this.cdr.markForCheck();
  }

  closeHistory(): void {
    this.historyOpen = false;
    this.cdr.markForCheck();
  }

  switchToSession(session: ConversationSession): void {
    this.saveCurrentSession();
    this.messages = session.messages;
    this.sessionTitle = session.title;
    this.sessionCreatedAt = session.createdAt;
    this.activeDinoId.set(session.dinoId);
    this.chatService.setThread(session.id);
    this.historyOpen = false;
    this.cdr.detectChanges();
  }

  deleteSession(id: string): void {
    const wasActive = this.chatService.currentThreadId === id;
    this.sessions = this.historyService.deleteSession(id);
    if (wasActive) {
      this.startNewChat();
    }
    this.cdr.markForCheck();
  }

  renameSession(id: string, title: string): void {
    const trimmed = title.trim();
    if (trimmed.length === 0) return;
    this.sessions = this.historyService.updateTitle(id, trimmed);
    if (this.chatService.currentThreadId === id) {
      this.sessionTitle = trimmed;
    }
    this.cdr.markForCheck();
  }

  togglePinSession(id: string): void {
    this.sessions = this.historyService.togglePin(id);
    this.cdr.markForCheck();
  }

  newChat(): void {
    this.saveCurrentSession();
    // Starting a new chat presents the dino picker first (PICK-01).
    this.pickerOpen.set(true);
    this.cdr.markForCheck();
  }

  private startNewChat(): void {
    this.messages = [{ text: 'Welcome to SpinoChat — the AI that survived. What can I help you with?', role: 'assistant', createdAt: Date.now() }];
    this.sessionTitle = '';
    this.sessionCreatedAt = 0;
    this.chatService.resetThread();
    this.historyOpen = false;
    this.cdr.detectChanges();
  }

  private saveCurrentSession(): void {
    if (!this.messages.some((m) => m.role === 'user')) return;
    this.sessions = this.historyService.upsertSession({
      id: this.chatService.currentThreadId,
      title: this.sessionTitle || 'Untitled',
      messages: [...this.messages],
      createdAt: this.sessionCreatedAt || Date.now(),
      dinoId: this.activeDinoId(),
    });
  }

  onSend(text: string): void {
    if (this.isLoading || this.isStreaming()) return;

    if (!this.sessionTitle) {
      this.sessionTitle = text.length > 50 ? text.slice(0, 50) + '…' : text;
      this.sessionCreatedAt = Date.now();
    }

    this.messages.push({ text, role: 'user', createdAt: Date.now() });
    this.beginRequest();
    this.dispatchRequest(text);
  }

  onRegenerate(index: number): void {
    if (this.isLoading || this.isStreaming()) return;
    if (index <= 0 || index >= this.messages.length) return;
    const target = this.messages[index];
    if (target.role !== 'assistant') return;
    const prevUser = this.messages[index - 1];
    if (!prevUser || prevUser.role !== 'user') return;

    this.messages = this.messages.slice(0, index);
    this.beginRequest();
    this.dispatchRequest(prevUser.text);
  }

  onEditAndResend(index: number, newText: string): void {
    if (this.isLoading || this.isStreaming()) return;
    const target = this.messages[index];
    if (!target || target.role !== 'user') return;

    this.saveCurrentSession();

    const truncated = this.messages.slice(0, index);
    this.chatService.resetThread();
    this.sessionTitle = newText.length > 50 ? newText.slice(0, 50) + '…' : newText;
    this.sessionCreatedAt = Date.now();
    this.messages = [...truncated, { text: newText, role: 'user', createdAt: Date.now() }];
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
  // this.messages, so it is excluded here; the backend receives it as `message`.
  private buildHistory(): ChatHistoryItem[] {
    const HISTORY_CAP = 20;
    return this.messages
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
      this.messages.push({
        text: '',
        role: 'tool',
        toolName: call.name,
        toolArgs: call.args,
        toolResult: call.result,
        createdAt: Date.now(),
      });
    }
    const assistantMsg: ChatMessage = {
      text: response,
      role: 'assistant',
      createdAt: Date.now(),
      ...(reasoning ? { reasoning } : {}),
      ...(reasoningDurationMs !== undefined ? { reasoningDurationMs } : {}),
    };
    this.messages.push(assistantMsg);
    this.clearStreaming();
    this.finishRequest();
  }

  private commitErrorTurn(message: string, link?: string): void {
    const partial = this.streamingText();
    if (partial.length > 0) {
      for (const call of this.streamingToolCalls()) {
        this.messages.push({
          text: '',
          role: 'tool',
          toolName: call.name,
          toolArgs: call.args,
          toolResult: call.result,
          createdAt: Date.now(),
        });
      }
      const footer = link
        ? `\n\n_Response interrupted: ${message}_ ([details](${link}))`
        : `\n\n_Response interrupted: ${message}_`;
      this.messages.push({ text: partial + footer, role: 'assistant', createdAt: Date.now() });
    } else {
      const linkPart = link ? `\n\n[View model on OpenRouter](${link})` : '';
      this.messages.push({ text: message + linkPart, role: 'error', createdAt: Date.now() });
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
    this.sessions = this.historyService.upsertSession({
      id: this.chatService.currentThreadId,
      title: this.sessionTitle,
      messages: [...this.messages],
      createdAt: this.sessionCreatedAt,
      dinoId: this.activeDinoId(),
    });
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    setTimeout(() => this.messageEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 0);
  }
}
