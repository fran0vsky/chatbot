import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import {
  AssistantDecision,
  AssistantInterpretRequest,
} from '@org/shared-types';

// The assistant brain is latency-sensitive (a person is waiting after speaking)
// and must be reliable, so it uses a cheap, fast paid model directly rather than
// a flaky free model. Cost is ~$0.0001 per command.
const INTERPRETER_MODEL = 'openai/gpt-4o-mini';

// The whitelist the assistant may choose from. MUST stay in sync with the
// frontend action-catalogue.ts (the frontend re-validates via dispatchCatalogued).
const ACTION_SPEC = `
- change_theme: params {"theme":"day"|"night"|"toggle"} — switch the colour theme (e.g. "dark mode", "switch to day")
- new_chat: params {} — open the dino picker to start a new chat (e.g. "start a new chat")
- switch_chat: params {"sessionId": string} — switch to an existing chat. Pick the sessionId from SESSIONS that best matches the user's description (topic or recency). (e.g. "open my chat about jazz", "go back to the last conversation")
- read_last_message: params {} — read the last assistant message aloud (e.g. "read that again", "what did it say")
- send_message: params {"text": string} — send a chat message on the user's behalf (e.g. "ask it what time it is")
- set_active_view: params {"view":"chats"|"explore"|"knowledge"|"groupchat"|"arena"|"leaderboard"} — navigate to a top-level view (e.g. "go to the arena", "show the leaderboard")
- select_dino: params {"dinoId": string} — switch the active dino. Pick dinoId from DINOS. Phrasings include "talk to X", "switch to X", "use X", "let me chat with X" where X is a dino name.`;

const VALID_ACTIONS = new Set([
  'change_theme',
  'new_chat',
  'switch_chat',
  'read_last_message',
  'send_message',
  'set_active_view',
  'select_dino',
]);

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  /**
   * Interpret a spoken command into a whitelisted action, a clarifying question,
   * or a refusal. Never throws — falls back to a clarify on any failure so the
   * caller can always speak something back.
   */
  async interpret(req: AssistantInterpretRequest): Promise<AssistantDecision> {
    const transcript = (req.transcript ?? '').trim();
    if (!transcript) {
      return { kind: 'clarify', say: "I didn't catch that — could you say it again?" };
    }

    const system = this.buildSystemPrompt(req);

    try {
      const llm = new ChatOpenAI({
        model: INTERPRETER_MODEL,
        apiKey: process.env['OPENROUTER_API_KEY'],
        configuration: { baseURL: 'https://openrouter.ai/api/v1' },
        temperature: 0,
        // Force a JSON object response so we always get parseable output.
        modelKwargs: { response_format: { type: 'json_object' } },
      });
      const res = (await llm.invoke([
        new SystemMessage(system),
        new HumanMessage(transcript),
      ])) as AIMessage;
      const raw = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
      return this.parseDecision(raw);
    } catch (err) {
      this.logger.error(
        `Assistant interpret failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { kind: 'clarify', say: "Sorry, I had trouble with that — could you try again?" };
    }
  }

  private buildSystemPrompt(req: AssistantInterpretRequest): string {
    const sessions = (req.sessions ?? [])
      .slice(0, 50)
      .map((s) => `{"id":"${s.id}","title":${JSON.stringify(s.title)}}`)
      .join(', ');
    const dinos = (req.dinos ?? [])
      .map((d) => `{"id":"${d.id}","name":${JSON.stringify(d.name)}}`)
      .join(', ');

    return `You are the command interpreter for a voice-controlled chat app. Convert the user's spoken command into EXACTLY ONE JSON object and nothing else.

You may ONLY choose from these actions:${ACTION_SPEC}

Respond with one JSON object:
- A clear command → {"kind":"action","name":"<action>","params":{...},"say":"<short spoken confirmation>"}
- Ambiguous or missing info (e.g. which chat?) → {"kind":"clarify","say":"<short spoken question>"}
- Anything NOT in the action list (e.g. delete account, log out, change password, anything destructive/unsupported) → {"kind":"refuse","say":"<short spoken explanation you can't do that>"}

Rules:
- "say" is spoken aloud: keep it short and natural.
- Never invent an action name outside the list.
- For switch_chat and select_dino, the id MUST come from the lists below.
- Prefer "clarify" over "refuse" when the command seems aimed at the app but is vague or unclear (e.g. "do the thing"). Only "refuse" when the user clearly asks for a capability that is NOT in the action list (e.g. delete account, log out, change password, anything destructive).

SESSIONS: [${sessions}]
DINOS: [${dinos}]
CURRENT_VIEW: ${req.currentView ?? 'chats'}`;
  }

  /** Defensive JSON parse + whitelist check. Falls back to clarify on anything odd. */
  private parseDecision(raw: string): AssistantDecision {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) {
      return { kind: 'clarify', say: "Sorry, I didn't understand that — could you rephrase?" };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return { kind: 'clarify', say: "Sorry, I didn't understand that — could you rephrase?" };
    }
    const d = parsed as Record<string, unknown>;
    const say = typeof d['say'] === 'string' && d['say'] ? (d['say'] as string) : 'Okay.';

    if (d['kind'] === 'refuse') return { kind: 'refuse', say };
    if (d['kind'] === 'action') {
      const name = d['name'];
      const params = (d['params'] ?? {}) as Record<string, unknown>;
      if (typeof name === 'string' && VALID_ACTIONS.has(name)) {
        return { kind: 'action', name, params, say };
      }
      // Hallucinated / non-whitelisted action → treat as a refusal (AST-03).
      return { kind: 'refuse', say: "I can't do that one — I can only control things inside the app." };
    }
    // Default / explicit clarify.
    return { kind: 'clarify', say };
  }
}
