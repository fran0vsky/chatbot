import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  AgentProfile,
  ChatHistoryItem,
  Dino,
  GroupMessage,
  GroupStreamEvent,
  SpeechIntent,
  TopicAnalysis,
  ARTIST_DEFAULT_REACTION,
} from '@org/shared-types';
import { DINOS, getDino } from './dinos';
import { AgentsService } from './agents.service';
import { getProfile } from './group/agent-profiles';
import {
  ConversationState,
  IntentDecision,
  TurnBudget,
  allowedIntents,
  canContinue,
  defaultBudget,
  initConversationState,
  lastDinoMessage,
  pickNextSpeaker,
  recordSilence,
  recordTurn,
  topicHitsWeakArea,
  validateIntent,
} from './group/governor';

// --- Cost ceiling (Phase 37) -------------------------------------------------
// A single user message triggers AT MOST:
//   1 topic-analysis call
// + up to MAX_GROUP_DINOS participants resolved
// + per speaking turn: 1 cheap intent call + 1 in-character generation call
//   bounded by the governor's TurnBudget.maxAgentMessages.
// `stay_silent` turns and image-gen reactions make ZERO generation calls.
const DIRECTOR_MODEL = 'openai/gpt-4o-mini';
const MAX_GROUP_DINOS = 4;
const HISTORY_CAP = 20;

// Bystander reactions: ~38% chance a non-speaking dino reacts after a real turn.
// Emojis are intentionally drawn from the shared REACTION_TOOLTIPS vocabulary.
const REACTION_CHANCE = 0.38;
const INTENT_REACTIONS: Partial<Record<SpeechIntent, readonly string[]>> = {
  answer_user:         ['👍', '💡', '🧠', '🎯'],
  agree_with_agent:    ['👍', '❤️', '🎯', '🙌'],
  build_on_agent:      ['🔥', '🚀', '⚡', '✨'],
  disagree_with_agent: ['🤔', '🤨', '⚔️', '🧐'],
  correct_agent:       ['🤔', '🛑', '🔄'],
  ask_agent:           ['❓', '👀'],
  admit_uncertainty:   ['💭', '😅'],
};

const ALL_INTENTS: readonly SpeechIntent[] = [
  'answer_user',
  'agree_with_agent',
  'disagree_with_agent',
  'build_on_agent',
  'correct_agent',
  'ask_agent',
  'admit_uncertainty',
  'stay_silent',
];

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

/** The per-turn directive appended to a dino's system prompt for HOW to speak. */
export function buildDirective(
  intent: SpeechIntent,
  profile: AgentProfile,
  targetName: string | undefined,
  topic: TopicAnalysis,
): string {
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
  const topicNote =
    topic.subtopics.length > 0 ? ` The discussion is about: ${topic.subtopics.join(', ')}.` : '';
  return [
    `## THIS GROUP-CHAT TURN`,
    `You are ${profile.name}, one of several dinos in a live group chat with the user and other dinos. Stay fully in character (${profile.speakingStyle}).`,
    `Keep it short and conversational — 1 to 3 sentences, like a real group chat, not an essay. Do NOT prefix your message with your own name. Always respond in English.`,
    `Your intent this turn: ${intent.replace(/_/g, ' ')}.${topicNote}`,
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

  /** Build the cheap director LLM (topic analysis + intent selection). */
  private directorLlm(): ChatOpenAI {
    return new ChatOpenAI({
      model: DIRECTOR_MODEL,
      apiKey: process.env['OPENROUTER_API_KEY'],
      configuration: { baseURL: 'https://openrouter.ai/api/v1' },
    });
  }

  private static parseJson(raw: string): unknown {
    try {
      return JSON.parse(raw.replace(/```(?:json)?/gi, '').trim());
    } catch {
      return undefined;
    }
  }

  /**
   * One cheap call analyzing the user message: subtopics, the expertise it
   * demands, whether it's genuinely contested, and the best-suited dinos. On any
   * failure, degrade to a keyword heuristic so the turn still proceeds.
   */
  protected async analyzeTopic(
    message: string,
    roster: Dino[],
    transcript: GroupMessage[],
    signal: AbortSignal,
  ): Promise<TopicAnalysis> {
    try {
      const profiles = roster.map((d) => getProfile(d.id));
      const rosterDesc = profiles
        .map((p) => `- ${p.name} (id: ${p.dinoId}) — strong: [${p.expertiseAreas.join(', ')}]`)
        .join('\n');
      const system = new SystemMessage(
        [
          'You analyze a user message for a group of AI "dinos" so a director can run a natural discussion.',
          'Return ONLY a JSON object (no prose, no code fences) of this exact shape:',
          '{ "subtopics": string[], "requiredExpertise": string[], "isContested": boolean, "bestSuitedDinoIds": string[] }',
          '- subtopics: the distinct askable parts of the question (e.g. ["fun","reliability","cost"]).',
          '- requiredExpertise: lowercase tags the question demands; prefer tags drawn from the roster\'s strengths.',
          '- isContested: true if reasonable experts would legitimately disagree.',
          '- bestSuitedDinoIds: roster ids ranked best-first by fit to the question.',
        ].join('\n'),
      );
      const human = new HumanMessage(
        [`Roster:\n${rosterDesc}`, `User message:\n${message}`].join('\n\n'),
      );
      const res = (await this.directorLlm().invoke([system, human], { signal })) as AIMessage;
      const content = typeof res.content === 'string' ? res.content : '';
      const parsed = GroupAgentsService.parseJson(content) as Partial<TopicAnalysis> | undefined;
      if (parsed && typeof parsed === 'object') {
        const rosterIds = new Set(roster.map((d) => d.id));
        return {
          subtopics: Array.isArray(parsed.subtopics) ? parsed.subtopics.map(String).slice(0, 6) : [],
          requiredExpertise: Array.isArray(parsed.requiredExpertise)
            ? parsed.requiredExpertise.map((t) => String(t).toLowerCase()).slice(0, 8)
            : [],
          isContested: parsed.isContested === true,
          bestSuitedDinoIds: Array.isArray(parsed.bestSuitedDinoIds)
            ? parsed.bestSuitedDinoIds.map(String).filter((id) => rosterIds.has(id))
            : [],
        };
      }
    } catch (err) {
      this.logger.warn(
        `Topic analysis failed (${err instanceof Error ? err.message : String(err)}); using heuristic.`,
      );
    }
    return this.heuristicTopic(message, roster);
  }

  /** Keyword fallback: match message words against each profile's strong tags. */
  private heuristicTopic(message: string, roster: Dino[]): TopicAnalysis {
    const lower = message.toLowerCase();
    const matched = new Set<string>();
    const ranked = roster
      .map((d) => {
        const p = getProfile(d.id);
        const hits = p.expertiseAreas.filter((t) => lower.includes(t.toLowerCase()));
        hits.forEach((h) => matched.add(h.toLowerCase()));
        return { id: d.id, score: hits.length + p.interactionBiases.talkativeness };
      })
      .sort((a, b) => b.score - a.score)
      .map((r) => r.id);
    return {
      subtopics: [],
      requiredExpertise: [...matched],
      isContested: /\b(or|vs|versus|better|worse|best|should|wrong|right)\b/.test(lower),
      bestSuitedDinoIds: ranked,
    };
  }

  /**
   * One cheap call choosing HOW the given dino speaks, constrained to `allowed`.
   * On any failure, fall back to a profile-weighted heuristic. The returned
   * decision is later run through the governor's `validateIntent`.
   */
  protected async decideIntent(
    profile: AgentProfile,
    state: ConversationState,
    allowed: SpeechIntent[],
    signal: AbortSignal,
    roster: Dino[],
  ): Promise<IntentDecision> {
    const last = lastDinoMessage(state);
    try {
      const nameById = new Map(roster.map((d) => [d.id, d.name]));
      const targetName = last?.dinoId ? nameById.get(last.dinoId) ?? 'a dino' : undefined;
      const system = new SystemMessage(
        [
          `You decide HOW ${profile.name} should speak next in a group chat (not the words).`,
          `Personality: ${profile.personality}. Debate style: ${profile.debateStyle}. Confidence: ${profile.confidence}.`,
          `Strong areas: [${profile.expertiseAreas.join(', ')}]. Weak areas: [${profile.weakAreas.join(', ')}].`,
          `Choose EXACTLY ONE intent from this allowed set: ${allowed.join(', ')}.`,
          'Guidance:',
          '- Pick disagree_with_agent / correct_agent ONLY with a real, expertise-backed point of difference — never to be contrarian.',
          '- If the topic is in your weak areas, prefer admit_uncertainty or ask_agent over bluffing.',
          "- Don't agree just to agree; if you'd only echo, choose stay_silent.",
          'Return ONLY JSON: { "intent": <one of the allowed>, "targetAgentId"?: string, "confidence": number 0..1 }',
        ].join('\n'),
      );
      const human = new HumanMessage(
        [
          `Topic subtopics: ${state.topic.subtopics.join(', ') || '(unknown)'}; contested: ${state.topic.isContested}.`,
          last
            ? `Most recent dino message — ${targetName} (${last.intent ?? 'answer'}): "${last.text}"`
            : 'No dino has spoken yet this turn.',
        ].join('\n'),
      );
      const res = (await this.directorLlm().invoke([system, human], { signal })) as AIMessage;
      const content = typeof res.content === 'string' ? res.content : '';
      const parsed = GroupAgentsService.parseJson(content) as
        | { intent?: string; targetAgentId?: string; confidence?: number }
        | undefined;
      if (parsed && typeof parsed === 'object') {
        const intent =
          typeof parsed.intent === 'string' && ALL_INTENTS.includes(parsed.intent as SpeechIntent)
            ? (parsed.intent as SpeechIntent)
            : 'answer_user';
        return {
          intent,
          targetAgentId:
            typeof parsed.targetAgentId === 'string' ? parsed.targetAgentId : last?.dinoId,
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : profile.confidence,
        };
      }
    } catch (err) {
      this.logger.warn(
        `Intent selection for ${profile.dinoId} failed (${err instanceof Error ? err.message : String(err)}); using heuristic.`,
      );
    }
    return this.heuristicIntent(profile, state, allowed);
  }

  /** Deterministic intent fallback driven by the profile's biases. */
  private heuristicIntent(
    profile: AgentProfile,
    state: ConversationState,
    allowed: SpeechIntent[],
  ): IntentDecision {
    const has = (i: SpeechIntent): boolean => allowed.includes(i);
    const last = lastDinoMessage(state);
    const target = last?.dinoId;
    const b = profile.interactionBiases;

    if (topicHitsWeakArea(profile, state.topic) && profile.confidence < 0.7) {
      if (has('admit_uncertainty')) return { intent: 'admit_uncertainty', confidence: 0.4 };
      if (has('ask_agent')) return { intent: 'ask_agent', targetAgentId: target, confidence: 0.5 };
    }
    if (b.likesToChallenge >= 0.6 && has('disagree_with_agent')) {
      return { intent: 'disagree_with_agent', targetAgentId: target, confidence: profile.confidence };
    }
    if (b.likesToSupport >= 0.6 && has('build_on_agent')) {
      return { intent: 'build_on_agent', targetAgentId: target, confidence: profile.confidence };
    }
    if (has('build_on_agent') && last) {
      return { intent: 'build_on_agent', targetAgentId: target, confidence: profile.confidence };
    }
    return { intent: 'answer_user', confidence: profile.confidence };
  }

  /**
   * Drive the whole group turn as a dynamic discussion over one SSE stream:
   *   topic analysis → loop { pick speaker → pick intent → generate } → done.
   * Speakers are chosen by the governor (heuristic, no LLM); intents are cheap
   * director calls constrained to the allowed set; only real speaking turns make
   * an in-character generation call. Always ends with group_done.
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
    const profiles = roster.map((d) => getProfile(d.id));
    const budget = defaultBudget(roster.length);

    const topic = await this.analyzeTopic(message, roster, history ?? [], signal);
    if (signal.aborted) return;

    const state = initConversationState(history ?? [], topic);
    // Record the user's message at the head of the working transcript.
    const userMessageId = newMessageId('user');
    state.transcript.push({ id: userMessageId, role: 'user', text: message, createdAt: Date.now() });

    // Empty plan keeps the SSE "plan first" contract; the frontend lays out dino
    // slots dynamically as token/done events arrive (no fixed rounds anymore).
    yield { type: 'plan', plan: { round1: [], round2: [] } };

    // @mentioned dinos are forced to answer the user first, in mention order.
    const forcedQueue = this.parseMentions(message, roster);

    while (canContinue(state, budget)) {
      if (signal.aborted) return;

      // --- (a) who speaks ----------------------------------------------------
      const forcedId = forcedQueue.find((id) => (state.perAgentTurns[id] ?? 0) === 0);
      if (forcedId) forcedQueue.splice(forcedQueue.indexOf(forcedId), 1);
      const speakerId = forcedId ?? pickNextSpeaker(profiles, state, budget);
      if (!speakerId) break;
      const profile = getProfile(speakerId);

      // --- (b) what intent ---------------------------------------------------
      let decision: IntentDecision;
      if (forcedId) {
        decision = { intent: 'answer_user', confidence: profile.confidence };
      } else {
        const allowed = allowedIntents(profile, state, budget);
        decision = await this.decideIntent(profile, state, allowed, signal, roster);
      }
      if (signal.aborted) return;
      decision = validateIntent(profile, decision, state, budget);

      // --- (c) silence: no generation call -----------------------------------
      if (decision.intent === 'stay_silent') {
        recordSilence(state, speakerId);
        if (state.consecutiveSilences >= 2) break; // nobody has anything to add
        continue;
      }

      // --- Image-gen dino reacts (it cannot surface text in the group stream) -
      if (this.isImageGenDino(speakerId)) {
        const target = decision.targetMessageId ?? userMessageId;
        yield { type: 'reaction', dinoId: speakerId, emoji: ARTIST_DEFAULT_REACTION, targetMessageId: target };
        // Mark it as having taken its chance so it isn't re-picked forever.
        state.perAgentTurns[speakerId] = (state.perAgentTurns[speakerId] ?? 0) + 1;
        state.lastSpeaker = speakerId;
        state.consecutiveSilences = 0;
        continue;
      }

      // --- (d) generate the in-character message -----------------------------
      const targetName = decision.targetAgentId
        ? roster.find((d) => d.id === decision.targetAgentId)?.name
        : undefined;
      const directive = buildDirective(decision.intent, profile, targetName, topic);
      const attributedHistory = buildAttributedHistory(state.transcript, speakerId, roster);
      const messageId = newMessageId(speakerId);
      let response = '';

      try {
        for await (const event of this.agentsService.streamAgent(
          message,
          `group-${speakerId}`,
          undefined,
          signal,
          undefined,
          speakerId,
          userId,
          attributedHistory,
          undefined,
          directive,
        )) {
          if (event.type === 'token') {
            response += event.text;
            yield { type: 'dino_token', dinoId: speakerId, text: event.text };
          } else if (event.type === 'done') {
            response = event.response;
          } else if (event.type === 'error') {
            yield { type: 'dino_error', dinoId: speakerId, message: event.message };
          }
          // tool_call_*, reasoning_token, image events are not surfaced here.
        }
      } catch (err) {
        this.logger.warn(
          `Answerer ${speakerId} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        yield { type: 'dino_error', dinoId: speakerId, message: 'This dino could not respond.' };
      }

      if (signal.aborted) return;

      // An empty response (e.g. the model returned nothing) shouldn't pollute the
      // transcript or count as a real turn — treat it as a silent pass.
      if (response.trim().length === 0) {
        recordSilence(state, speakerId);
        if (state.consecutiveSilences >= 2) break;
        continue;
      }

      yield {
        type: 'dino_done',
        dinoId: speakerId,
        response,
        messageId,
        intent: decision.intent,
        replyToMessageId: decision.targetMessageId,
        replyToAgentId: decision.targetAgentId,
        confidence: decision.confidence,
      };

      state.transcript.push({
        id: messageId,
        role: 'dino',
        dinoId: speakerId,
        text: response,
        createdAt: Date.now(),
        intent: decision.intent,
        replyToMessageId: decision.targetMessageId,
        replyToAgentId: decision.targetAgentId,
        confidence: decision.confidence,
      });
      recordTurn(state, speakerId, decision);

      // Bystander reaction: a random non-speaking text dino occasionally reacts.
      const reactionOptions = INTENT_REACTIONS[decision.intent];
      if (reactionOptions && Math.random() < REACTION_CHANCE) {
        const bystanders = roster.filter((d) => d.id !== speakerId && !this.isImageGenDino(d.id));
        if (bystanders.length > 0) {
          const bystander = bystanders[Math.floor(Math.random() * bystanders.length)];
          const emoji = reactionOptions[Math.floor(Math.random() * reactionOptions.length)];
          yield { type: 'reaction', dinoId: bystander.id, emoji, targetMessageId: messageId };
        }
      }
    }

    yield { type: 'group_done' };
  }
}

/** Server-generated, collision-resistant message id. */
function newMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
