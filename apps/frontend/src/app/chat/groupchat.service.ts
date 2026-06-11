import { Injectable, Signal, inject, signal } from '@angular/core';
import {
  ChatMessage,
  ConversationSession,
  GroupMessage,
  GroupReaction,
  GroupStreamEvent,
} from '@org/shared-types';
import { ChatService, newUuid } from './chat.service';

/** Streaming/completion status for a dino message row in the transcript. */
export type GroupMessageStatus = 'streaming' | 'done' | 'error';

/**
 * One attributed message in the interleaved group transcript, plus the
 * frontend-only view state the transcript needs (streaming status, the
 * server-assigned messageId reactions target, and any error text).
 */
export interface GroupViewMessage extends GroupMessage {
  /** Only present for `role === 'dino'` rows. User rows are always settled. */
  status?: GroupMessageStatus;
  /** Server-assigned id from `dino_done`; reactions may target it. */
  serverMessageId?: string;
  /** Error text when `status === 'error'`. */
  error?: string;
}

/**
 * Turn-based group-chat client (Phase 35). On each `send` it posts the user
 * message + the accumulated attributed transcript (capped) to the single backend
 * endpoint `POST /api/agents/group` and renders one interleaved top-to-bottom
 * transcript from the multiplexed `GroupStreamEvent` stream:
 *  - `plan` lays out Round-1 answerer slots in the orchestrator's chosen order;
 *  - `dino_token`/`dino_done` route into a dino's slot by id;
 *  - `reaction` pins an emoji chip onto its target message (no new line);
 *  - Round-2 replies with no open slot append in arrival order.
 *
 * The old parallel fan-out (per-dino `group-{groupId}-{dinoId}` threads,
 * `DinoStreamEntry[]`) is removed — there is no fallback.
 */
@Injectable({ providedIn: 'root' })
export class GroupchatService {
  private readonly chatService = inject(ChatService);

  /** Max dinos selectable in groupchat mode (DoS mitigation T-23-01 / T-35-02-01). */
  static readonly MAX_DINOS = 4;

  /** Recent attributed turns sent back as history (D-09 / HISTORY_CAP). */
  private static readonly HISTORY_CAP = 20;

  private readonly _messages = signal<GroupViewMessage[]>([]);
  private readonly _streaming = signal<boolean>(false);

  /** The ordered interleaved transcript, rendered top-to-bottom. */
  readonly messages: Signal<GroupViewMessage[]> = this._messages.asReadonly();
  /** True while a group turn is in flight. */
  readonly streaming: Signal<boolean> = this._streaming.asReadonly();

  private controller?: AbortController;

  /**
   * Stable id for the current group thread. Created on the first `send` of a
   * fresh session (or set by `loadSession` when reopening) and reused across
   * turns so re-saving updates the same ConversationSession instead of
   * duplicating it. Reset by `startNewSession`.
   */
  private groupSessionId?: string;

  /** When the current group session was first created (stable across turns). */
  private groupSessionCreatedAt = Date.now();

  /** The participant roster for the current session (saved on the session). */
  private participantDinoIds: string[] = [];

  /**
   * Send one user message to the selected dinos and stream the group turn.
   * Aborts any prior in-flight turn first. Participants are capped at MAX_DINOS;
   * history is capped at HISTORY_CAP attributed turns.
   */
  send(message: string, participantDinoIds: string[]): void {
    const text = message.trim();
    if (text.length === 0) return;

    this.stopAll();

    const cappedIds = participantDinoIds.slice(0, GroupchatService.MAX_DINOS);
    if (cappedIds.length === 0) return;

    // Establish a stable session id + roster on the first send of a fresh thread.
    if (!this.groupSessionId) {
      this.groupSessionId = newUuid();
      this.groupSessionCreatedAt = Date.now();
    }
    this.participantDinoIds = cappedIds;

    // History is the transcript BEFORE this turn's user message, capped.
    const history: GroupMessage[] = this._messages()
      .map((m) => this.toWireMessage(m))
      .slice(-GroupchatService.HISTORY_CAP);

    const userMessage: GroupViewMessage = {
      id: newUuid(),
      role: 'user',
      text,
      createdAt: Date.now(),
    };
    this._messages.update((list) => [...list, userMessage]);

    const controller = new AbortController();
    this.controller = controller;
    this._streaming.set(true);

    void this.consume(text, cappedIds, history, controller.signal);
  }

  /** Abort the in-flight group stream and clear the streaming flag. */
  stopAll(): void {
    this.controller?.abort();
    this.controller = undefined;
    this._streaming.set(false);
  }

  /**
   * Build a persistable ConversationSession (D-08) from the current transcript:
   * a single interleaved, attributed message list flagged `isGroup` and carrying
   * the participant roster, under a stable id so re-saving updates in place.
   */
  toSession(title: string): ConversationSession {
    if (!this.groupSessionId) {
      this.groupSessionId = newUuid();
      this.groupSessionCreatedAt = Date.now();
    }
    return {
      id: this.groupSessionId,
      title,
      isGroup: true,
      participantDinoIds: [...this.participantDinoIds],
      messages: this._messages().map((m) => this.groupMessageToChatMessage(m)),
      createdAt: this.groupSessionCreatedAt,
    };
  }

  /**
   * Reopen a persisted group thread (Success Criterion #4): adopt its stable id,
   * restore the interleaved `messages` signal from the saved transcript, and
   * return the saved roster so the component can restore the dino selection.
   */
  loadSession(session: ConversationSession): string[] {
    this.stopAll();
    this.groupSessionId = session.id;
    this.groupSessionCreatedAt = session.createdAt;
    this.participantDinoIds = session.participantDinoIds ?? [];
    this._messages.set(session.messages.map((m) => this.chatMessageToGroupMessage(m)));
    return [...this.participantDinoIds];
  }

  /** Reset to a fresh, empty group session (new stable id assigned on next send). */
  startNewSession(): void {
    this.stopAll();
    this.groupSessionId = undefined;
    this.groupSessionCreatedAt = Date.now();
    this.participantDinoIds = [];
    this._messages.set([]);
  }

  /**
   * Map an in-transcript group message to a persistable ChatMessage:
   * `'user'` → `'user'`; `'dino'` → `'assistant'` carrying its `dinoId`.
   */
  private groupMessageToChatMessage(m: GroupViewMessage): ChatMessage {
    const base: ChatMessage = {
      text: m.text,
      role: m.role === 'user' ? 'user' : 'assistant',
      createdAt: m.createdAt,
    };
    if (m.role === 'dino' && m.dinoId) base.dinoId = m.dinoId;
    if (m.reactions && m.reactions.length > 0) base.reactions = m.reactions;
    if (m.intent) base.intent = m.intent;
    if (m.replyToAgentId) base.replyToAgentId = m.replyToAgentId;
    return base;
  }

  /**
   * Map a persisted ChatMessage back to a settled group transcript message:
   * `'assistant'` + `dinoId` → group `'dino'`; otherwise → `'user'`.
   */
  private chatMessageToGroupMessage(m: ChatMessage): GroupViewMessage {
    const isDino = m.role === 'assistant';
    const view: GroupViewMessage = {
      id: newUuid(),
      role: isDino ? 'dino' : 'user',
      text: m.text,
      createdAt: m.createdAt ?? Date.now(),
    };
    if (isDino) {
      view.status = 'done';
      if (m.dinoId) view.dinoId = m.dinoId;
      if (m.intent) view.intent = m.intent;
      if (m.replyToAgentId) view.replyToAgentId = m.replyToAgentId;
    }
    if (m.reactions && m.reactions.length > 0) view.reactions = m.reactions;
    return view;
  }

  /** Strip frontend-only view state before sending a message back as history. */
  private toWireMessage(m: GroupViewMessage): GroupMessage {
    return {
      id: m.id,
      role: m.role,
      ...(m.dinoId ? { dinoId: m.dinoId } : {}),
      text: m.text,
      ...(m.reactions ? { reactions: m.reactions } : {}),
      ...(m.intent ? { intent: m.intent } : {}),
      ...(m.replyToMessageId ? { replyToMessageId: m.replyToMessageId } : {}),
      ...(m.replyToAgentId ? { replyToAgentId: m.replyToAgentId } : {}),
      ...(m.confidence !== undefined ? { confidence: m.confidence } : {}),
      createdAt: m.createdAt,
    };
  }

  private async consume(
    message: string,
    participantDinoIds: string[],
    history: GroupMessage[],
    signal: AbortSignal,
  ): Promise<void> {
    try {
      for await (const event of this.chatService.streamGroup(
        message,
        participantDinoIds,
        history,
        signal,
      )) {
        if (signal.aborted) break;
        this.applyEvent(event);
      }
    } catch {
      // streamGroup surfaces network/read failures as dino_error frames; any
      // unexpected throw simply ends the turn.
    } finally {
      // Only clear shared state if a newer send() has not already replaced it.
      if (this.controller?.signal === signal) {
        this.controller = undefined;
        this._streaming.set(false);
        // Settle any rows still 'streaming' (stream ended without `group_done`,
        // e.g. a mid-turn drop) so a stuck placeholder is never persisted as a
        // blank `done` bubble: keep partial text as done, drop-to-error if empty.
        this.settleOpenSlots();
      }
    }
  }

  /**
   * Force-settle any dino rows left in `status: 'streaming'` after a turn ends.
   * Rows with partial text become `done`; empty placeholders become `error`
   * (never persisted as blank answers).
   */
  private settleOpenSlots(): void {
    this._messages.update((list) => {
      let changed = false;
      const next = list.map((m) => {
        if (m.role !== 'dino' || m.status !== 'streaming') return m;
        changed = true;
        return m.text.length > 0
          ? { ...m, status: 'done' as const }
          : { ...m, status: 'error' as const, error: 'No response.' };
      });
      return changed ? next : list;
    });
  }

  /** Apply a single GroupStreamEvent to the transcript signal. */
  private applyEvent(event: GroupStreamEvent): void {
    switch (event.type) {
      case 'plan': {
        // Pre-create ordered Round-1 placeholder slots in plan order (D-03).
        const answerers = event.plan.round1
          .filter((d) => d.action === 'answer')
          .slice()
          .sort((a, b) => a.order - b.order);
        if (answerers.length === 0) return;
        const placeholders: GroupViewMessage[] = answerers.map((d) => ({
          id: newUuid(),
          role: 'dino',
          dinoId: d.dinoId,
          text: '',
          createdAt: Date.now(),
          status: 'streaming',
        }));
        this._messages.update((list) => [...list, ...placeholders]);
        return;
      }
      case 'dino_token': {
        this.appendToken(event.dinoId, event.text);
        return;
      }
      case 'dino_done': {
        this.finalizeDino(event.dinoId, event.response, event.messageId, {
          intent: event.intent,
          replyToMessageId: event.replyToMessageId,
          replyToAgentId: event.replyToAgentId,
          confidence: event.confidence,
        });
        return;
      }
      case 'reaction': {
        this.attachReaction(event.targetMessageId, {
          dinoId: event.dinoId,
          emoji: event.emoji,
        });
        return;
      }
      case 'dino_error': {
        this.markDinoError(event.dinoId, event.message);
        return;
      }
      case 'group_done': {
        this._streaming.set(false);
        return;
      }
    }
  }

  /** Append a streamed token to the dino's open slot, creating one if needed. */
  private appendToken(dinoId: string, text: string): void {
    this._messages.update((list) => {
      const idx = this.findOpenSlot(list, dinoId);
      if (idx === -1) {
        // Round-2 reply with no pre-created slot — append a fresh streaming row.
        return [
          ...list,
          {
            id: newUuid(),
            role: 'dino',
            dinoId,
            text,
            createdAt: Date.now(),
            status: 'streaming',
          },
        ];
      }
      const next = list.slice();
      next[idx] = { ...next[idx], text: next[idx].text + text };
      return next;
    });
  }

  /** Finalize a dino's slot with the full response + server messageId + social metadata. */
  private finalizeDino(
    dinoId: string,
    response: string,
    messageId: string,
    meta: {
      intent?: GroupViewMessage['intent'];
      replyToMessageId?: string;
      replyToAgentId?: string;
      confidence?: number;
    },
  ): void {
    this._messages.update((list) => {
      const idx = this.findOpenSlot(list, dinoId);
      if (idx === -1) {
        return [
          ...list,
          {
            id: newUuid(),
            role: 'dino',
            dinoId,
            text: response,
            createdAt: Date.now(),
            status: 'done',
            serverMessageId: messageId,
            ...meta,
          },
        ];
      }
      const next = list.slice();
      next[idx] = {
        ...next[idx],
        text: response,
        status: 'done',
        serverMessageId: messageId,
        ...meta,
      };
      return next;
    });
  }

  /** Mark a dino's open slot as errored (or append an errored row). */
  private markDinoError(dinoId: string, message: string): void {
    this._messages.update((list) => {
      const idx = this.findOpenSlot(list, dinoId);
      if (idx === -1) {
        if (dinoId.length === 0) return list; // transport-level error, no slot
        return [
          ...list,
          {
            id: newUuid(),
            role: 'dino',
            dinoId,
            text: '',
            createdAt: Date.now(),
            status: 'error',
            error: message,
          },
        ];
      }
      const next = list.slice();
      next[idx] = { ...next[idx], status: 'error', error: message };
      return next;
    });
  }

  /** Pin a reaction chip onto its target message (by id or serverMessageId). */
  private attachReaction(targetMessageId: string | undefined, reaction: GroupReaction): void {
    if (!targetMessageId) return;
    this._messages.update((list) =>
      list.map((m) =>
        m.id === targetMessageId || m.serverMessageId === targetMessageId
          ? { ...m, reactions: [...(m.reactions ?? []), reaction] }
          : m,
      ),
    );
  }

  /** Index of the dino's currently-streaming slot, or -1 if none is open. */
  private findOpenSlot(list: GroupViewMessage[], dinoId: string): number {
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (m.role === 'dino' && m.dinoId === dinoId && m.status === 'streaming') {
        return i;
      }
    }
    return -1;
  }
}
