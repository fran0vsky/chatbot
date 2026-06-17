import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  AgentProfile,
  ChatHistoryItem,
  Dino,
  DinoDecision,
  GroupMessage,
  GroupStreamEvent,
  SpeechIntent,
  ARTIST_DEFAULT_REACTION,
} from '@org/shared-types';
import { DINOS, getDino } from './dinos';
import { AgentsService } from './agents.service';
import { getProfile } from './group/agent-profiles';
import { ConversationState, initConversationState } from './group/governor';
import {
  MAX_GROUP_DINOS,
  MAX_ROUNDS,
  RoundCounters,
  atTotalAnswerCap,
  buildDecisionPrompt,
  dinoAtAnswerCap,
  heuristicDecision,
  initRoundCounters,
  parseDecision,
  recordAnswer,
  shouldStopRounds,
} from './group/decision';

// --- Cost ceiling (Group Engine v3, Phase 41) --------------------------------
// The flat cost ceiling lives in `group/decision.ts` (MAX_GROUP_DINOS,
// MAX_ROUNDS, MAX_ANSWERS_PER_DINO, MAX_TOTAL_ANSWERS). A single user message
// triggers AT MOST: (MAX_GROUP_DINOS × MAX_ROUNDS) per-dino decision calls
// (each on the dino's OWN model) + MAX_TOTAL_ANSWERS in-character generation
// calls. `react`/`silent` decisions and image-gen reactions make ZERO
// generation calls; a zero-answer round stops the loop early.
const HISTORY_CAP = 20;

/**
 * Convert the interleaved group transcript into the `ChatHistoryItem[]` a
 * specific answerer receives: the answerer's OWN prior dino messages map to
 * `assistant`; every other speaker (the user and other dinos) maps to a
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

/**
 * The per-turn directive appended to a dino's system prompt for HOW to speak.
 * v3: driven by the dino's OWN `DinoDecision` (it chose its own stance) — no
 * central topic analysis anymore. `decision.intent ?? 'answer_user'` is used.
 */
export function buildDirective(
  decision: DinoDecision,
  profile: AgentProfile,
  targetName: string | undefined,
): string {
  const intent: SpeechIntent = decision.intent ?? 'answer_user';
  const who = targetName ?? 'the previous dino';
  const bodies: Record<SpeechIntent, string> = {
    answer_user:
      "Answer the user's question directly from your strengths, and add a fresh angle the others haven't covered yet.",
    build_on_agent: `Add a NEW point on top of what ${who} said — extend or sharpen it, don't restate it.`,
    agree_with_agent: `You agree with ${who}, but you MUST add something: a reason, an example, or a caveat. Never just say "I agree".`,
    disagree_with_agent: `You see it differently from ${who}. First concede what they got right, then state your specific disagreement and WHY. Stay respectful.`,
    correct_agent: `${who} said something you believe is factually off. Correct that one specific point briefly and plainly — no smugness, no piling on.`,
    ask_agent: `Ask ${who} a genuine, pointed question about the part they know best.`,
    admit_uncertainty:
      'This is outside your strong areas. Say so plainly, give only the practical take you are sure of, and name which dino is better suited for the rest.',
    stay_silent: 'Say nothing.',
  };
  return [
    `## THIS GROUP-CHAT TURN`,
    `You are ${profile.name}, one of several dinos in a live group chat with the user and other dinos. Stay fully in character (${profile.speakingStyle}).`,
    `Keep it short and conversational — 1 to 3 sentences, like a real group chat, not an essay. Do NOT prefix your message with your own name. Always respond in English.`,
    `Your intent this turn: ${intent.replace(/_/g, ' ')}.`,
    bodies[intent],
  ].join('\n');
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

  /** True for image-generation dinos — they react instead of answering (no text). */
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
   * v3: ONE autonomous decision call for a single dino, on that dino's OWN model
   * (`dino.model`), in full persona. Builds the persona decision prompt from the
   * live attributed thread (so it includes the current round's earlier turns),
   * invokes the dino's model, and tolerantly parses the result into a
   * `DinoDecision`. On ANY error/abort it degrades to `heuristicDecision` so a
   * flaky/slow free model never breaks the turn (it just acts heuristically).
   */
  protected async decideAction(
    profile: AgentProfile,
    dino: Dino,
    state: ConversationState,
    roster: Dino[],
    hasPriorDinoThisRound: boolean,
    signal: AbortSignal,
  ): Promise<DinoDecision> {
    try {
      const attributedHistory = buildAttributedHistory(state.transcript, dino.id, roster);
      const threadText = attributedHistory.map((h) => h.text).join('\n');
      const { system, human } = buildDecisionPrompt(profile, threadText, hasPriorDinoThisRound);
      const llm = new ChatOpenAI({
        model: dino.model,
        apiKey: process.env['OPENROUTER_API_KEY'],
        configuration: { baseURL: 'https://openrouter.ai/api/v1' },
      });
      const res = (await llm.invoke(
        [new SystemMessage(system), new HumanMessage(human)],
        { signal },
      )) as AIMessage;
      const content = typeof res.content === 'string' ? res.content : '';
      return parseDecision(content);
    } catch (err) {
      this.logger.warn(
        `Decision call for ${dino.id} failed (${err instanceof Error ? err.message : String(err)}); using heuristic.`,
      );
      return heuristicDecision(profile, hasPriorDinoThisRound);
    }
  }

  /**
   * Image-gen dinos cannot return a JSON text decision (their model is an image
   * model), so they bypass the LLM decision entirely and deterministically take
   * the `react` (default artist emoji) path against the most recent message, or
   * stay silent when there is nothing yet to react to. No LLM call.
   */
  private imageGenDecision(state: ConversationState): DinoDecision {
    const last = state.transcript[state.transcript.length - 1];
    if (!last) return { action: 'silent' };
    return { action: 'react', emoji: ARTIST_DEFAULT_REACTION, replyToMessageId: last.id };
  }

  /**
   * Group Engine v3: a multi-round autonomous loop over one SSE stream. There is
   * NO central director. For each round (capped at MAX_ROUNDS), EVERY participant
   * dino, in turn, makes its OWN decision call on its OWN model (`decideAction`)
   * against the full attributed thread so far — including earlier dinos' turns
   * from the CURRENT round, because each completed answer is pushed onto
   * `state.transcript` before the next dino decides. A dino chooses answer /
   * react / silent: an `answer` streams an in-character reply on its own model and
   * emits dino_token + dino_done; a `react` emits one reaction event (no
   * generation); a `silent` emits nothing. Image-gen dinos skip the LLM decision
   * (`imageGenDecision`). The Plan 01 cost ceiling is enforced every iteration.
   * Always starts with an (empty) plan and ends with group_done.
   */
  async *streamGroup(
    message: string,
    participantDinoIds: string[],
    userId: string | undefined,
    history: GroupMessage[] | undefined,
    signal: AbortSignal,
  ): AsyncGenerator<GroupStreamEvent, void, void> {
    const roster = this.resolveRoster(participantDinoIds);
    if (roster.length === 0) {
      yield { type: 'group_done' };
      return;
    }

    // Working transcript: prior history + the just-received user message.
    const state: ConversationState = initConversationState(history ?? [], {
      subtopics: [],
      requiredExpertise: [],
      isContested: false,
      bestSuitedDinoIds: [],
    });
    const userMessageId = newMessageId('user');
    state.transcript.push({ id: userMessageId, role: 'user', text: message, createdAt: Date.now() });

    const counters: RoundCounters = initRoundCounters();

    // Empty plan keeps the SSE "plan first" contract; the frontend lays out dino
    // slots dynamically as token/done events arrive (no fixed rounds anymore).
    yield { type: 'plan', plan: { round1: [], round2: [] } };

    // @mentioned dinos are forced to answer in round 0, moved to the front.
    const forced = new Set(this.parseMentions(message, roster));

    for (let roundIndex = 0; roundIndex < MAX_ROUNDS; roundIndex++) {
      if (signal.aborted) return;

      // Round 0: mentioned dinos go first (and are forced to answer). Later
      // rounds use pure autonomous decisions in roster order.
      const order =
        roundIndex === 0 && forced.size > 0
          ? [...roster].sort(
              (a, b) => Number(forced.has(b.id)) - Number(forced.has(a.id)),
            )
          : roster;

      let answersThisRound = 0;

      for (const dino of order) {
        if (signal.aborted) return;
        if (atTotalAnswerCap(counters)) {
          yield { type: 'group_done' };
          return;
        }

        const profile = getProfile(dino.id);
        const hasPriorDinoThisRound = state.transcript.some((m) => m.role === 'dino');
        const isForcedAnswer = roundIndex === 0 && forced.has(dino.id);

        // --- decide -----------------------------------------------------------
        let decision: DinoDecision;
        if (this.isImageGenDino(dino.id)) {
          decision = this.imageGenDecision(state);
        } else if (isForcedAnswer) {
          decision = { action: 'answer', intent: 'answer_user', confidence: profile.confidence };
        } else {
          decision = await this.decideAction(
            profile,
            dino,
            state,
            roster,
            hasPriorDinoThisRound,
            signal,
          );
        }
        if (signal.aborted) return;

        // --- enforce the per-dino answer cap (anti-monologue) -----------------
        if (decision.action === 'answer' && dinoAtAnswerCap(counters, dino.id)) {
          decision = hasPriorDinoThisRound
            ? { action: 'react', emoji: '👍', replyToMessageId: this.lastMessageId(state) }
            : { action: 'silent' };
        }

        // --- react: a single pinned reaction, no generation -------------------
        if (decision.action === 'react') {
          yield {
            type: 'reaction',
            dinoId: dino.id,
            emoji: decision.emoji ?? '👍',
            targetMessageId: decision.replyToMessageId ?? this.lastMessageId(state),
          };
          continue;
        }

        // --- silent: nothing --------------------------------------------------
        if (decision.action === 'silent') {
          continue;
        }

        // --- answer: stream an in-character reply on the dino's own model -----
        const targetName = decision.replyToAgentId
          ? roster.find((d) => d.id === decision.replyToAgentId)?.name
          : undefined;
        const directive = buildDirective(decision, profile, targetName);
        const attributedHistory = buildAttributedHistory(state.transcript, dino.id, roster);
        const messageId = newMessageId(dino.id);
        let response = '';

        try {
          for await (const event of this.agentsService.streamAgent(
            message,
            `group-${dino.id}`,
            undefined,
            signal,
            undefined,
            dino.id,
            userId,
            attributedHistory,
            undefined,
            directive,
          )) {
            if (event.type === 'token') {
              response += event.text;
              yield { type: 'dino_token', dinoId: dino.id, text: event.text };
            } else if (event.type === 'done') {
              response = event.response;
            } else if (event.type === 'error') {
              yield { type: 'dino_error', dinoId: dino.id, message: event.message };
            }
            // tool_call_*, reasoning_token, image events are not surfaced here.
          }
        } catch (err) {
          this.logger.warn(
            `Answerer ${dino.id} failed: ${err instanceof Error ? err.message : String(err)}`,
          );
          yield { type: 'dino_error', dinoId: dino.id, message: 'This dino could not respond.' };
        }

        if (signal.aborted) return;

        // An empty response (e.g. the model returned nothing) shouldn't pollute
        // the transcript or count as a real turn — treat it as a silent pass.
        if (response.trim().length === 0) {
          continue;
        }

        yield {
          type: 'dino_done',
          dinoId: dino.id,
          response,
          messageId,
          intent: decision.intent ?? 'answer_user',
          replyToMessageId: decision.replyToMessageId,
          replyToAgentId: decision.replyToAgentId,
          confidence: decision.confidence,
        };

        // Push BEFORE the next dino decides → sequential thread context (GRP3-02).
        state.transcript.push({
          id: messageId,
          role: 'dino',
          dinoId: dino.id,
          text: response,
          createdAt: Date.now(),
          intent: decision.intent ?? 'answer_user',
          replyToMessageId: decision.replyToMessageId,
          replyToAgentId: decision.replyToAgentId,
          confidence: decision.confidence,
        });
        recordAnswer(counters, dino.id);
        answersThisRound++;
      }

      if (shouldStopRounds(roundIndex, answersThisRound)) break;
    }

    yield { type: 'group_done' };
  }

  /** The id of the most recent transcript message (for pinning reactions). */
  private lastMessageId(state: ConversationState): string | undefined {
    return state.transcript[state.transcript.length - 1]?.id;
  }
}

/** Server-generated, collision-resistant message id. */
function newMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
