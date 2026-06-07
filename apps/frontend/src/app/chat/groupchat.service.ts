import { Injectable, Signal, inject, signal } from '@angular/core';
import {
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

  /** Strip frontend-only view state before sending a message back as history. */
  private toWireMessage(m: GroupViewMessage): GroupMessage {
    return {
      id: m.id,
      role: m.role,
      ...(m.dinoId ? { dinoId: m.dinoId } : {}),
      text: m.text,
      ...(m.reactions ? { reactions: m.reactions } : {}),
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
      }
    }
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
        this.finalizeDino(event.dinoId, event.response, event.messageId);
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

  /** Finalize a dino's slot with the full response + server messageId. */
  private finalizeDino(dinoId: string, response: string, messageId: string): void {
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
          },
        ];
      }
      const next = list.slice();
      next[idx] = {
        ...next[idx],
        text: response,
        status: 'done',
        serverMessageId: messageId,
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
