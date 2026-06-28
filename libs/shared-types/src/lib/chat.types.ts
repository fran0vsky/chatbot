import type { GroupReaction } from './group.types.js';
import type { SpeechIntent } from './group-social.js';

/**
 * A single prior turn sent so the backend has within-thread context.
 * Now also carries retained images (capped to the last 2 image-bearing user
 * turns) and replayed tool results so the model can reference them without
 * re-attaching or re-fetching — working memory for within-thread continuity.
 */
export interface ChatHistoryItem {
  role: 'user' | 'assistant' | 'tool';
  text: string;
  /**
   * Prior user image (base64 data URL), forwarded for vision-model replay.
   * Capped to the 2 most-recent image-bearing user turns; older turns omit this.
   */
  imageDataUrl?: string;
  /** Name of the tool that was called (present on role:'tool' items). */
  toolName?: string;
  /** Arguments passed to the tool (present on role:'tool' items). */
  toolArgs?: Record<string, unknown>;
  /** Textual result returned by the tool (present on role:'tool' items). */
  toolResult?: string;
}

export interface ChatRequest {
  message: string;
  threadId?: string;
  model?: string;
  /**
   * Optional image attached to this turn, as a base64 data URL
   * (e.g. `data:image/png;base64,...`). One image per turn (VIS-01).
   * Only the vision dino's model reasons about it natively; other dinos
   * fall back to a vision-capable model server-side.
   */
  imageDataUrl?: string;
  /** Tool names the user has enabled. Undefined = all available tools. */
  enabledTools?: string[];
  /** Selected dino. When present, backend resolves model + system prompt + tools from it. */
  dinoId?: string;
  /** Anonymous per-device user id (localStorage). Scopes cross-thread memory per (userId × dinoId). */
  userId?: string;
  /** Recent prior turns (capped) so multi-turn follow-ups have context. */
  history?: ChatHistoryItem[];
}

export interface ToolInfo {
  name: string;
  label: string;
  description: string;
}

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: string;
}

export interface ChatResponse {
  response: string;
  toolCalls?: ToolCallRecord[];
}

export type MessageRole = 'user' | 'assistant' | 'error' | 'tool';

export interface ChatMessage {
  text: string;
  role: MessageRole;
  /**
   * Stable per-message id. Used to anchor side threads to a specific message
   * (Side Threads feature). Optional for backward-compat with sessions persisted
   * before ids existed — backfilled on load.
   */
  id?: string;
  /**
   * True when this assistant message is the condensed summary folded into the
   * main conversation after a side thread was merged. Styled distinctly so the
   * user can tell "main answer" from "merged side-note".
   */
  mergeNote?: boolean;
  /** Image the user attached to this turn (base64 data URL), rendered inline (VIS-01). */
  imageDataUrl?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  reasoning?: string;
  reasoningDurationMs?: number;
  createdAt?: number;
  /**
   * Group-thread attribution (D-08): the dino that spoke this message in a
   * persisted group transcript. Present on `role === 'assistant'` rows that
   * originated from a group dino; absent for single-dino chats.
   */
  dinoId?: string;
  /**
   * Group-thread attribution (D-08): emoji reactions pinned to this message in
   * a persisted group transcript, so a saved group chat round-trips its chips.
   */
  reactions?: GroupReaction[];
  /** Group social role this message played (Phase 37), for the intent chip. */
  intent?: SpeechIntent;
  /** The dino this message replied to (Phase 37), for the reply stub. */
  replyToAgentId?: string;
}

/**
 * A side thread (drill-down branch) anchored to a specific main-thread message.
 * Lets the user interrogate / fact-check an answer in an ISOLATED context: the
 * main agent never sees these turns until the thread is merged. Because the
 * backend is stateless and replays whatever `history` the client sends, keeping
 * branch turns in this separate array is the entire isolation mechanism.
 */
export interface SideThread {
  id: string;
  /** id of the main-thread ChatMessage this thread drills into. */
  anchorMessageId: string;
  /** Short preview of the anchored message, for the thread header. */
  anchorPreview: string;
  /** The branch's own back-and-forth (ja → dino → ja). Never enters main context. */
  messages: ChatMessage[];
  /** 'open' while drilling; 'merged' once folded into main; 'discarded' if dropped. */
  status: 'open' | 'merged' | 'discarded';
  /** The condensed takeaway loaded into the main context on merge. */
  mergeSummary?: string;
  createdAt: number;
}

export interface ConversationSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  pinned?: boolean;
  /** Side threads (drill-down branches) opened against this session's messages. */
  sideThreads?: SideThread[];
  /** The dino bound to this session; sent as dinoId on every message. */
  dinoId?: string;
  /** True when this session is a persisted group thread (D-08). */
  isGroup?: boolean;
  /** Saved participant roster for a group thread, so it reopens with the exact dino set (D-08). */
  participantDinoIds?: string[];
}

export interface StreamTokenEvent {
  type: 'token';
  text: string;
}

export interface StreamToolCallStartEvent {
  type: 'tool_call_start';
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface StreamToolCallResultEvent {
  type: 'tool_call_result';
  id: string;
  result: string;
}

export interface StreamReasoningTokenEvent {
  type: 'reasoning_token';
  text: string;
}

export interface StreamDoneEvent {
  type: 'done';
  response: string;
  toolCalls?: ToolCallRecord[];
  reasoning?: string;
  reasoningDurationMs?: number;
}

export interface StreamErrorEvent {
  type: 'error';
  message: string;
  link?: string;
}

/** An image generated by an artist dino (base64 data URL), rendered inline (IMG-01/02). */
export interface StreamImageEvent {
  type: 'image';
  imageDataUrl: string;
}

/** Emitted once per turn when a taught skill has been selected for this conversation (MEM2-01). */
export interface StreamSkillActiveEvent {
  type: 'skill_active';
  skillId: string;
  skillTitle: string;
}

export type StreamEvent =
  | StreamTokenEvent
  | StreamReasoningTokenEvent
  | StreamToolCallStartEvent
  | StreamToolCallResultEvent
  | StreamImageEvent
  | StreamSkillActiveEvent
  | StreamDoneEvent
  | StreamErrorEvent;
