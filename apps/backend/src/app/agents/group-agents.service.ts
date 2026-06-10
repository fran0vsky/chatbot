import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  ChatHistoryItem,
  Dino,
  DinoTurnDecision,
  GroupMessage,
  GroupOrchestratorPlan,
  GroupStreamEvent,
  REACTION_TOOLTIPS,
  ARTIST_DEFAULT_REACTION,
} from '@org/shared-types';
import { DINOS, getDino } from './dinos';
import { AgentsService } from './agents.service';

// --- Cost ceiling (D-01 / D-02) ---------------------------------------------
// A single user message triggers AT MOST:
//   1 orchestrator call
// + up to MAX_GROUP_DINOS Round-1 answerers
// + up to MAX_INTER_DINO_REPLIES Round-2 answerers
// = the documented hard per-turn LLM-call ceiling (1 + 4 + 3 = 8).
// `react`/`silent` dinos make ZERO model calls. Participants are capped to
// MAX_GROUP_DINOS before the orchestrator runs (forward of the Phase 23
// MAX_DINOS cap); Round 2 is clamped to MAX_INTER_DINO_REPLIES.
const ORCHESTRATOR_MODEL = 'openai/gpt-4o-mini';
const MAX_GROUP_DINOS = 4;
// Round-2 inter-dino replies. Raised from 2 → 3 so the group reads as a
// conversation (dinos building on / pushing back on each other) rather than two
// parallel monologues.
const MAX_INTER_DINO_REPLIES = 3;
const HISTORY_CAP = 20;

const VALID_ACTIONS: ReadonlyArray<DinoTurnDecision['action']> = ['answer', 'react', 'silent'];

/** The minimal "everyone answers in roster order" plan used as a safe fallback. */
function allAnswerPlan(roster: Dino[]): GroupOrchestratorPlan {
  return {
    round1: roster.map((d, i) => ({ dinoId: d.id, action: 'answer', order: i })),
    round2: [],
  };
}

/** Pick the first emoji-like cluster from a string (keeps a single emoji). */
function firstEmoji(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  // Take the first Unicode code point cluster (covers most single emoji).
  return [...trimmed][0];
}

/** Narrow an unknown value to a `DinoTurnDecision` against the roster. */
function coerceDecision(
  raw: unknown,
  rosterIds: Set<string>,
  fallbackOrder: number,
): DinoTurnDecision | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const obj = raw as Record<string, unknown>;
  const dinoId = typeof obj['dinoId'] === 'string' ? obj['dinoId'] : undefined;
  if (!dinoId || !rosterIds.has(dinoId)) return undefined;

  const rawAction = obj['action'];
  const action: DinoTurnDecision['action'] =
    typeof rawAction === 'string' && VALID_ACTIONS.includes(rawAction as DinoTurnDecision['action'])
      ? (rawAction as DinoTurnDecision['action'])
      : 'silent';

  const order = typeof obj['order'] === 'number' ? obj['order'] : fallbackOrder;
  const decision: DinoTurnDecision = { dinoId, action, order };

  if (action === 'react') {
    const emoji = firstEmoji(obj['emoji']);
    if (!emoji) return undefined; // a react with no emoji is meaningless — drop it
    decision.emoji = emoji;
  }
  if (typeof obj['targetMessageId'] === 'string') decision.targetMessageId = obj['targetMessageId'];
  if (typeof obj['respondingTo'] === 'string') decision.respondingTo = obj['respondingTo'];
  return decision;
}

/**
 * Defensively parse the orchestrator's raw JSON plan: strip code fences,
 * JSON.parse, coerce/validate each decision against the roster, drop unknown
 * dinoIds, force `action` into the union, keep a single emoji on `react`, and
 * clamp `round2` to MAX_INTER_DINO_REPLIES. On ANY failure, return the safe
 * all-answer fallback plan so the group still responds.
 */
export function parseOrchestratorPlan(raw: string, roster: Dino[]): GroupOrchestratorPlan {
  const rosterIds = new Set(roster.map((d) => d.id));
  try {
    const stripped = raw.replace(/```(?:json)?/gi, '').trim();
    const parsed: unknown = JSON.parse(stripped);
    if (typeof parsed !== 'object' || parsed === null) return allAnswerPlan(roster);
    const obj = parsed as Record<string, unknown>;

    const round1Raw = Array.isArray(obj['round1']) ? (obj['round1'] as unknown[]) : [];
    const round2Raw = Array.isArray(obj['round2']) ? (obj['round2'] as unknown[]) : [];

    const round1 = round1Raw
      .map((d, i) => coerceDecision(d, rosterIds, i))
      .filter((d): d is DinoTurnDecision => d !== undefined);
    const round2 = round2Raw
      .map((d, i) => coerceDecision(d, rosterIds, i))
      .filter((d): d is DinoTurnDecision => d !== undefined)
      .slice(0, MAX_INTER_DINO_REPLIES);

    if (round1.length === 0 && round2.length === 0) return allAnswerPlan(roster);
    return { round1, round2 };
  } catch {
    return allAnswerPlan(roster);
  }
}

/**
 * Convert the interleaved group transcript into the `ChatHistoryItem[]` a
 * specific answerer receives (D-09): the answerer's OWN prior dino messages map
 * to `assistant`; every other speaker (the user and other dinos) maps to a
 * label-prefixed `user` turn (`User: …` / `<Name>: …`). Reactions are appended
 * as a short note. Sliced to the most recent HISTORY_CAP turns.
 */
export function buildAttributedHistory(
  transcript: GroupMessage[],
  answeringDinoId: string,
  roster: Dino[],
): ChatHistoryItem[] {
  const nameById = new Map(roster.map((d) => [d.id, d.name]));
  const items: ChatHistoryItem[] = transcript.map((msg) => {
    const reactionNote =
      msg.reactions && msg.reactions.length > 0
        ? ' ' +
          msg.reactions
            .map((r) => `(${nameById.get(r.dinoId) ?? r.dinoId} reacted ${r.emoji})`)
            .join(' ')
        : '';

    if (msg.role === 'dino' && msg.dinoId === answeringDinoId) {
      return { role: 'assistant', text: `${msg.text}${reactionNote}` };
    }
    const label = msg.role === 'user' ? 'User' : nameById.get(msg.dinoId ?? '') ?? 'Dino';
    return { role: 'user', text: `${label}: ${msg.text}${reactionNote}` };
  });
  return items.slice(-HISTORY_CAP);
}

@Injectable()
export class GroupAgentsService {
  private readonly logger = new Logger(GroupAgentsService.name);

  constructor(private readonly agentsService: AgentsService) {}

  /** Resolve participant ids to real, unique dinos, capped to MAX_GROUP_DINOS. */
  private resolveRoster(participantDinoIds: string[]): Dino[] {
    const known = new Set(DINOS.map((d) => d.id));
    const seen = new Set<string>();
    const roster: Dino[] = [];
    for (const id of participantDinoIds) {
      if (!known.has(id) || seen.has(id)) continue;
      seen.add(id);
      roster.push(getDino(id));
      if (roster.length >= MAX_GROUP_DINOS) break;
    }
    return roster;
  }

  /**
   * True for image-generation dinos (e.g. Vinci). Their output is an image,
   * which the group stream does not surface (D-03), so a text `answer` slot
   * would render blank and waste a paid image call. In group mode such a dino
   * REACTS instead of answering.
   */
  private isImageGenDino(dinoId: string): boolean {
    return getDino(dinoId).imageGen === true;
  }

  /** Forced dinoIds from `@<name>` mentions, matched case-insensitively. */
  private parseMentions(message: string, roster: Dino[]): string[] {
    const forced: string[] = [];
    for (const dino of roster) {
      const pattern = new RegExp(`@${dino.name}\\b`, 'i');
      if (pattern.test(message)) forced.push(dino.id);
    }
    return forced;
  }

  /**
   * One cheap orchestrator call producing the structured participation plan.
   * On any failure, degrades to the all-answer fallback. After parsing, any
   * @mentioned dino is FORCED to answer in Round 1 (override + append).
   */
  private async runOrchestrator(
    message: string,
    roster: Dino[],
    transcript: GroupMessage[],
    forcedIds: string[],
    signal: AbortSignal,
  ): Promise<GroupOrchestratorPlan> {
    let plan: GroupOrchestratorPlan;
    try {
      const rosterDesc = roster
        .map((d) => `- ${d.name} (id: ${d.id}) — ${d.persona} Specialty: ${d.specialty}.`)
        .join('\n');
      const transcriptText =
        transcript.length > 0
          ? transcript
              .slice(-HISTORY_CAP)
              .map((m) => `${m.role === 'user' ? 'User' : roster.find((d) => d.id === m.dinoId)?.name ?? 'Dino'}: ${m.text}`)
              .join('\n')
          : '(no prior messages)';
      const forcedNames = forcedIds
        .map((id) => roster.find((d) => d.id === id)?.name)
        .filter((n): n is string => !!n);

      const system = new SystemMessage(
        [
          'You are the orchestrator for a group chat of AI "dinos". Decide, per dino, how it participates this turn.',
          'Return ONLY a JSON object (no prose, no code fences) with this exact shape:',
          '{ "round1": [{ "dinoId": string, "action": "answer"|"react"|"silent", "emoji"?: string, "order": number }],',
          '  "round2": [{ "dinoId": string, "action": "answer"|"react"|"silent", "emoji"?: string, "respondingTo"?: string, "order": number }] }',
          'Rules:',
          '- Each dino does EXACTLY ONE action per round: answer, react (a SINGLE emoji), or silent.',
          '- Aim for a LIVELY group: every participant should usually do something visible. A dino that does not answer should almost always "react" with a fitting emoji; reserve "silent" only for when even a reaction would be pure noise.',
          '- Round 1 = dinos that directly answer the user. Pick the 2-3 dinos whose specialties best fit (more than one perspective is good); the remaining dinos "react" (or, rarely, stay silent).',
          `- Round 2 = up to ${MAX_INTER_DINO_REPLIES} dinos reacting to the Round-1 answers, to make it feel like a conversation. A dino either ANSWERS to build on, add to, or respectfully push back on a specific dino (set "respondingTo" to that dino's id), or REACTS with a single emoji to a specific dino's answer (also set "respondingTo"). STRONGLY favor a competent dino VOLUNTEERING when it has a genuinely different take, a disagreement, or a concrete useful addition. A dino with nothing distinct should react rather than echo, or stay silent.`,
          forcedNames.length > 0
            ? `- The user @mentioned these dinos; they MUST answer in Round 1: ${forcedNames.join(', ')}.`
            : '- No dinos were @mentioned.',
          '- A "react" decision MUST include a single emoji, chosen ONLY from this captioned set (pick the one whose meaning fits): ' +
            Object.entries(REACTION_TOOLTIPS)
              .map(([e, caption]) => `${e}=${caption}`)
              .join(', ') +
            '. "answer"/"silent" must NOT include an emoji.',
          '- Order is ascending speaking order within the round.',
        ].join('\n'),
      );
      const human = new HumanMessage(
        [
          `Participants:\n${rosterDesc}`,
          `Recent transcript:\n${transcriptText}`,
          `New user message:\n${message}`,
          forcedNames.length > 0 ? `Forced (must answer): ${forcedNames.join(', ')}` : '',
        ]
          .filter((s) => s.length > 0)
          .join('\n\n'),
      );

      const llm = new ChatOpenAI({
        model: ORCHESTRATOR_MODEL,
        apiKey: process.env['OPENROUTER_API_KEY'],
        configuration: { baseURL: 'https://openrouter.ai/api/v1' },
      });
      const res = (await llm.invoke([system, human], { signal })) as AIMessage;
      const content = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
      plan = parseOrchestratorPlan(content, roster);
    } catch (err) {
      this.logger.warn(
        `Orchestrator call failed (${err instanceof Error ? err.message : String(err)}); ` +
          'falling back to all-answer plan.',
      );
      plan = allAnswerPlan(roster);
    }

    return plan;
  }

  /** Override forced dinos to `answer` in Round 1, appending any that are absent. */
  private applyMentionForcing(plan: GroupOrchestratorPlan, forcedIds: string[]): GroupOrchestratorPlan {
    if (forcedIds.length === 0) return plan;
    const round1 = [...plan.round1];
    let nextOrder = round1.reduce((max, d) => Math.max(max, d.order), -1) + 1;
    for (const id of forcedIds) {
      const existing = round1.find((d) => d.dinoId === id);
      if (existing) {
        if (existing.action !== 'answer') {
          existing.action = 'answer';
          delete existing.emoji;
        }
      } else {
        round1.push({ dinoId: id, action: 'answer', order: nextOrder++ });
      }
    }
    return { round1, round2: plan.round2 };
  }

  /**
   * Run a single answerer through the unchanged single-dino loop, re-tagging
   * its events with the dinoId. Returns the assembled response text.
   */
  private async *runAnswerer(
    decision: DinoTurnDecision,
    message: string,
    transcript: GroupMessage[],
    roster: Dino[],
    userId: string | undefined,
    signal: AbortSignal,
  ): AsyncGenerator<GroupStreamEvent, string, void> {
    const { dinoId } = decision;
    const messageId = `${dinoId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const history = buildAttributedHistory(transcript, dinoId, roster);
    let response = '';
    try {
      for await (const event of this.agentsService.streamAgent(
        message,
        `group-${dinoId}`,
        undefined,
        signal,
        undefined,
        dinoId,
        userId,
        history,
        undefined,
      )) {
        if (event.type === 'token') {
          response += event.text;
          yield { type: 'dino_token', dinoId, text: event.text };
        } else if (event.type === 'done') {
          response = event.response;
          yield { type: 'dino_done', dinoId, response: event.response, messageId };
        } else if (event.type === 'error') {
          yield { type: 'dino_error', dinoId, message: event.message };
        }
        // tool_call_*, reasoning_token, image events are not surfaced in group mode.
      }
    } catch (err) {
      this.logger.warn(
        `Answerer ${dinoId} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      yield { type: 'dino_error', dinoId, message: 'This dino could not respond.' };
    }
    return response;
  }

  /**
   * Drive the whole group turn over one SSE stream: orchestrator plan,
   * concurrent Round 1, bounded sequential Round 2. Always ends with group_done.
   */
  async *streamGroup(
    message: string,
    participantDinoIds: string[],
    userId: string | undefined,
    history: GroupMessage[] | undefined,
    signal: AbortSignal,
  ): AsyncGenerator<GroupStreamEvent, void, void> {
    const roster = this.resolveRoster(participantDinoIds);
    const transcript: GroupMessage[] = [...(history ?? [])];

    if (roster.length === 0) {
      yield { type: 'group_done' };
      return;
    }

    const forcedIds = this.parseMentions(message, roster);
    const rawPlan = await this.runOrchestrator(message, roster, transcript, forcedIds, signal);
    // @mention forcing is enforced by the engine (GRP2-02 / D-04) regardless of
    // what the orchestrator returned: a forced dino is overridden to `answer`.
    const plan = this.applyMentionForcing(rawPlan, forcedIds);
    yield { type: 'plan', plan };
    if (signal.aborted) return;

    // Record the user's message at the head of the working transcript.
    const userMessageId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    transcript.push({
      id: userMessageId,
      role: 'user',
      text: message,
      createdAt: Date.now(),
    });

    // Round 1 reactions cost no LLM call — emit them up front. An image-gen
    // dino assigned `answer` is converted to a react here (it cannot show its
    // image in the group stream) so it is still visibly present.
    for (const decision of plan.round1) {
      if (decision.action === 'react' && decision.emoji) {
        yield {
          type: 'reaction',
          dinoId: decision.dinoId,
          emoji: decision.emoji,
          targetMessageId: decision.targetMessageId ?? userMessageId,
        };
      } else if (decision.action === 'answer' && this.isImageGenDino(decision.dinoId)) {
        yield {
          type: 'reaction',
          dinoId: decision.dinoId,
          emoji: ARTIST_DEFAULT_REACTION,
          targetMessageId: userMessageId,
        };
      }
    }

    // --- Round 1: answerers run CONCURRENTLY, events multiplexed (D-03) ------
    // Image-gen dinos are excluded (handled as reactions above).
    const answerers = plan.round1
      .filter((d) => d.action === 'answer' && !this.isImageGenDino(d.dinoId))
      .sort((a, b) => a.order - b.order);

    const round1Answers = yield* this.runConcurrentStream(
      answerers,
      message,
      transcript,
      roster,
      userId,
      signal,
    );
    if (signal.aborted) return;
    // Append completed Round-1 answers in PLAN order (not completion order) so
    // Round 2 sees a stable, orchestrator-ordered transcript regardless of which
    // dino finished streaming first.
    for (const decision of answerers) {
      const ans = round1Answers.find((a) => a.dinoId === decision.dinoId);
      if (!ans) continue;
      transcript.push({
        id: ans.messageId,
        role: 'dino',
        dinoId: ans.dinoId,
        text: ans.response,
        createdAt: Date.now(),
      });
    }

    // --- Round 2: SEQUENTIAL so each replier sees the Round-1 answers (D-02) -
    // Defensive clamp: parseOrchestratorPlan already caps round2, but enforce the
    // ceiling here too so the cost bound holds regardless of how the plan arrived.
    const round2 = [...plan.round2]
      .sort((a, b) => a.order - b.order)
      .slice(0, MAX_INTER_DINO_REPLIES);
    for (const decision of round2) {
      if (signal.aborted) return;
      if (decision.action === 'react' && decision.emoji) {
        // A Round-2 reaction targets another dino's answer. The orchestrator
        // cannot know message ids at plan time, so resolve `respondingTo`
        // (a dinoId) to that dino's most recent message in the transcript;
        // without a target the frontend silently drops the reaction.
        const targetMessageId =
          decision.targetMessageId ??
          (decision.respondingTo
            ? [...transcript].reverse().find((m) => m.dinoId === decision.respondingTo)?.id
            : undefined);
        yield {
          type: 'reaction',
          dinoId: decision.dinoId,
          emoji: decision.emoji,
          targetMessageId,
        };
        continue;
      }
      if (decision.action !== 'answer') continue;

      // Image-gen dino can't surface an answer in the group stream — react to
      // the dino it was responding to (or the user) instead of running a
      // dropped, paid image call.
      if (this.isImageGenDino(decision.dinoId)) {
        const targetMessageId =
          (decision.respondingTo
            ? [...transcript].reverse().find((m) => m.dinoId === decision.respondingTo)?.id
            : undefined) ?? userMessageId;
        yield {
          type: 'reaction',
          dinoId: decision.dinoId,
          emoji: ARTIST_DEFAULT_REACTION,
          targetMessageId,
        };
        continue;
      }

      const gen = this.runAnswerer(decision, message, transcript, roster, userId, signal);
      let next = await gen.next();
      while (!next.done) {
        yield next.value;
        next = await gen.next();
      }
      const response = next.value;
      transcript.push({
        id: `${decision.dinoId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'dino',
        dinoId: decision.dinoId,
        text: response,
        createdAt: Date.now(),
      });
    }

    yield { type: 'group_done' };
  }

  /**
   * Start every answerer's generator concurrently and multiplex their events
   * onto the stream AS THEY ARRIVE (D-03): tokens from all Round-1 dinos
   * interleave live rather than being buffered until the slowest one finishes.
   * The frontend renders strictly in plan order via the dino-tagged events.
   * Returns the assembled per-dino answers for the caller to fold into the
   * transcript. On abort, stops draining and asks each still-pending generator
   * to return so the underlying streamAgent calls unwind.
   */
  private async *runConcurrentStream(
    decisions: DinoTurnDecision[],
    message: string,
    transcript: GroupMessage[],
    roster: Dino[],
    userId: string | undefined,
    signal: AbortSignal,
  ): AsyncGenerator<
    GroupStreamEvent,
    { dinoId: string; response: string; messageId: string }[],
    void
  > {
    const answers: { dinoId: string; response: string; messageId: string }[] = [];
    const states = decisions.map((decision) => ({
      decision,
      gen: this.runAnswerer(decision, message, transcript, roster, userId, signal),
      messageId: '',
    }));

    // One in-flight next() promise per still-active generator, tagged with its
    // index so Promise.race can tell us which generator produced the next event.
    const pending = new Map<
      number,
      Promise<{ idx: number; res: IteratorResult<GroupStreamEvent, string> }>
    >();
    states.forEach((state, idx) => {
      pending.set(idx, state.gen.next().then((res) => ({ idx, res })));
    });

    while (pending.size > 0) {
      if (signal.aborted) break;
      const { idx, res } = await Promise.race(pending.values());
      if (res.done) {
        pending.delete(idx);
        const state = states[idx];
        answers.push({
          dinoId: state.decision.dinoId,
          response: res.value,
          messageId:
            state.messageId ||
            `${state.decision.dinoId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        });
      } else {
        const event = res.value;
        if (event.type === 'dino_done') states[idx].messageId = event.messageId;
        yield event;
        pending.set(idx, states[idx].gen.next().then((r) => ({ idx, res: r })));
      }
    }

    // Aborted mid-flight: unwind any generators still pending so their
    // streamAgent calls stop instead of finishing in the background.
    if (pending.size > 0) {
      await Promise.allSettled(
        [...pending.keys()].map((idx) => states[idx].gen.return('')),
      );
    }

    return answers;
  }
}
