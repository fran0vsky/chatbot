import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  ChatHistoryItem,
  Dino,
  SaveCreatedSkillResponse,
  SynthesizedSkill,
} from '@org/shared-types';
import { getDino } from '../agents/dinos';
import { MemoryService } from './memory.service';

// Mirror agents.service: free OpenRouter models 429 transiently, so every creator
// LLM call retries once on a cheap, reliable paid model. Image-gen dinos can't run
// the text task, so they use this model directly. Pennies per call.
const FALLBACK_MODEL = 'openai/gpt-4o-mini';

const SUGGEST_COUNT = 3;
const MAX_SUGGESTIONS = 8;

/** Mirrors agents.service capability/rate detection — worth a single paid-model retry. */
function isCapabilityError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('402') ||
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('no endpoints') ||
    msg.includes('quota') ||
    msg.includes('context length') ||
    msg.includes('model not found')
  );
}

/** Strip ``` fences and grab the first {...} JSON object from a model reply. */
function extractJsonBlock(raw: string): string {
  let text = raw.trim();
  // Remove leading/trailing markdown code fences (``` or ```json).
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1);
  }
  return text;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Parse a synthesize reply into a SynthesizedSkill. Defensive: strips fences,
 * JSON.parse, coerces missing fields. On any failure, falls back to using the
 * raw input as the instruction so synthesize never throws.
 */
export function parseSynthesized(raw: string, fallbackInstruction: string): SynthesizedSkill {
  try {
    const parsed: unknown = JSON.parse(extractJsonBlock(raw));
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const instruction = asString(obj['instruction']).trim() || fallbackInstruction;
      return {
        title: asString(obj['title']).trim(),
        whenToActivate: asString(obj['whenToActivate']).trim(),
        instruction,
      };
    }
  } catch {
    // fall through to the raw-input fallback
  }
  return { title: '', whenToActivate: '', instruction: fallbackInstruction };
}

/** Server-side reconcile decision: either create a new skill or update an existing id. */
export interface ReconcileDecision {
  decision: string; // 'new' or an existing skill id
  mergedTitle?: string;
  mergedWhenToActivate?: string;
  mergedInstruction?: string;
}

/** Parse a reconcile reply into a ReconcileDecision. Defaults to 'new' on any failure. */
export function parseReconcile(raw: string): ReconcileDecision {
  try {
    const parsed: unknown = JSON.parse(extractJsonBlock(raw));
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const decision = asString(obj['decision']).trim() || 'new';
      return {
        decision,
        mergedTitle: asString(obj['mergedTitle']).trim() || undefined,
        mergedWhenToActivate: asString(obj['mergedWhenToActivate']).trim() || undefined,
        mergedInstruction: asString(obj['mergedInstruction']).trim() || undefined,
      };
    }
  } catch {
    // fall through to 'new'
  }
  return { decision: 'new' };
}

/**
 * AI Memory Creator engine (Phase 34). Three server-side operations over the active
 * dino's own model with a paid fallback: suggest things worth remembering from the
 * conversation, synthesize a chosen suggestion / free text into the 3-field skill
 * shape, and reconcile-and-save (server decides create vs update). Targets DinoSkills
 * only (D-01); never touches the background userMemories pipeline (D-02).
 */
@Injectable()
export class MemoryCreatorService {
  private readonly logger = new Logger(MemoryCreatorService.name);

  constructor(private readonly memory: MemoryService) {}

  /** Image-gen dinos can't do the text task — use a text-capable fallback (D-04). */
  private buildModel(dino: Dino): string {
    return dino.imageGen ? FALLBACK_MODEL : dino.model;
  }

  /** Resolve a dino server-side or reject — the client never sends the model (D-04). */
  private resolveDino(dinoId: string): Dino {
    const dino = getDino(dinoId);
    if (!dino) {
      throw new BadRequestException('Unknown dinoId');
    }
    return dino;
  }

  /** One-shot text invocation against a model, mirroring extractAndStoreMemories wiring. */
  private async invokeText(model: string, messages: BaseMessage[]): Promise<string> {
    const llm = new ChatOpenAI({
      model,
      apiKey: process.env['OPENROUTER_API_KEY'],
      configuration: { baseURL: 'https://openrouter.ai/api/v1' },
    });
    const res = (await llm.invoke(messages)) as AIMessage;
    return typeof res.content === 'string' ? res.content : '';
  }

  /** Try the primary model; on a capability/rate error retry once on the paid fallback. */
  private async invokeWithFallback(primary: string, messages: BaseMessage[]): Promise<string> {
    try {
      return await this.invokeText(primary, messages);
    } catch (err) {
      if (primary !== FALLBACK_MODEL && isCapabilityError(err)) {
        this.logger.warn(
          `Creator LLM failover ${primary} -> ${FALLBACK_MODEL}: ${err instanceof Error ? err.message : String(err)}`,
        );
        return await this.invokeText(FALLBACK_MODEL, messages);
      }
      throw err;
    }
  }

  /**
   * Suggest ≥3 short, distinct things worth remembering about how the user wants the
   * dino to behave, derived from the conversation (SC#1). Degrades to [] on any LLM
   * failure so a creator failure never breaks the chat.
   */
  async suggest(userId: string, dinoId: string, history: ChatHistoryItem[]): Promise<string[]> {
    const dino = this.resolveDino(dinoId);
    const conversation = (history ?? [])
      .map((h) => `${h.role}: ${h.text}`)
      .join('\n')
      .trim();
    const system = new SystemMessage(
      `You are ${dino.name}. Read the conversation and propose at least ${SUGGEST_COUNT} short, ` +
        'distinct things worth remembering about how this user wants you to behave in future chats ' +
        '(preferences, tone, formatting, recurring needs). Each should be a single concise phrase. ' +
        'Reply with one suggestion per line and nothing else.',
    );
    const human = new HumanMessage(
      conversation.length > 0
        ? `Conversation so far:\n${conversation}`
        : 'There is no conversation yet. Suggest general, broadly useful behaviors worth remembering.',
    );
    try {
      const content = await this.invokeWithFallback(this.buildModel(dino), [system, human]);
      return content
        .split('\n')
        .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
        .filter((line) => line.length > 0)
        .slice(0, MAX_SUGGESTIONS);
    } catch (err) {
      this.logger.warn(
        `suggest failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  /**
   * Turn a chosen suggestion OR free natural text into the 3-field skill shape (SC#2).
   * On any LLM/parse failure, returns the raw input as the instruction.
   */
  async synthesize(userId: string, dinoId: string, input: string): Promise<SynthesizedSkill> {
    const dino = this.resolveDino(dinoId);
    const system = new SystemMessage(
      `You are ${dino.name}. Turn the user's note into a reusable behavior for future chats. ` +
        'Reply with STRICT JSON only, no prose, no code fences, in exactly this shape: ' +
        '{"title": string, "whenToActivate": string, "instruction": string}. ' +
        'title: a short label. whenToActivate: when this behavior applies (empty string "" if it should always apply). ' +
        'instruction: the concrete behavior, phrased as a direct instruction to you.',
    );
    const human = new HumanMessage(`User note:\n${input}`);
    try {
      const content = await this.invokeWithFallback(this.buildModel(dino), [system, human]);
      return parseSynthesized(content, input);
    } catch (err) {
      this.logger.warn(
        `synthesize failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
      );
      return { title: '', whenToActivate: '', instruction: input };
    }
  }

  /**
   * Persist the item, auto-deciding create vs update against the user's existing skills
   * (D-07/D-08). With no existing skills, always creates. Otherwise an LLM reconcile call
   * returns 'new' or an existing skill id; an id maps to updateSkill (folding the delta
   * into the merged instruction), anything else maps to addSkill. The decision is never
   * surfaced to the client — only the final skill + a plain action string.
   */
  async reconcileAndSave(
    userId: string,
    dinoId: string,
    item: SynthesizedSkill,
  ): Promise<SaveCreatedSkillResponse> {
    const dino = this.resolveDino(dinoId);
    const existing = await this.memory.getSkills(userId, dinoId);

    if (existing.length === 0) {
      const skill = await this.memory.addSkill(userId, dinoId, item.title, item.instruction, item.whenToActivate);
      if (!skill) {
        throw new ServiceUnavailableException('Could not persist skill (database unavailable)');
      }
      return { skill: { ...skill, whenToActivate: skill.whenToActivate ?? undefined }, action: 'created' };
    }

    let decision: ReconcileDecision = { decision: 'new' };
    try {
      const existingBlock = existing
        .map((s) => `- id: ${s.id}\n  title: ${s.title}\n  instruction: ${s.instruction}`)
        .join('\n');
      const system = new SystemMessage(
        `You are ${dino.name}. Decide whether a new behavior is genuinely NEW or OVERLAPS an existing one. ` +
          'Reply with STRICT JSON only, no prose, no code fences: ' +
          '{"decision": "new" | "<existingId>", "mergedTitle"?: string, "mergedWhenToActivate"?: string, "mergedInstruction"?: string}. ' +
          'If it overlaps an existing behavior, set decision to that behavior\'s id and provide merged fields that fold ' +
          'the new behavior into the existing one (combine additive details, drop contradictions). ' +
          'If it is genuinely new, set decision to "new".',
      );
      const human = new HumanMessage(
        `New behavior:\n  title: ${item.title}\n  whenToActivate: ${item.whenToActivate ?? ''}\n  instruction: ${item.instruction}\n\nExisting behaviors:\n${existingBlock}`,
      );
      const content = await this.invokeWithFallback(this.buildModel(dino), [system, human]);
      decision = parseReconcile(content);
    } catch (err) {
      this.logger.warn(
        `reconcile failed (non-fatal, defaulting to create): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const match = existing.find((s) => s.id === decision.decision);
    if (match) {
      const updated = await this.memory.updateSkill(match.id, {
        title: decision.mergedTitle ?? match.title,
        whenToActivate: decision.mergedWhenToActivate ?? item.whenToActivate ?? match.whenToActivate ?? undefined,
        instruction: decision.mergedInstruction ?? item.instruction,
      });
      if (!updated) {
        throw new ServiceUnavailableException('Could not persist skill (database unavailable)');
      }
      return { skill: { ...updated, whenToActivate: updated.whenToActivate ?? undefined }, action: 'updated' };
    }

    const created = await this.memory.addSkill(userId, dinoId, item.title, item.instruction, item.whenToActivate);
    if (!created) {
      throw new ServiceUnavailableException('Could not persist skill (database unavailable)');
    }
    return { skill: { ...created, whenToActivate: created.whenToActivate ?? undefined }, action: 'created' };
  }
}
