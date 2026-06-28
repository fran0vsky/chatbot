import { ChatHistoryItem, ChatMessage } from '@org/shared-types';

/** Default cap on conversational (user/assistant) turns replayed as context. */
export const HISTORY_CAP = 20;
/** Default cap on retained images in context (last N image-bearing user turns). */
export const IMAGE_CAP = 2;

/**
 * Convert a list of rendered ChatMessages into the capped ChatHistoryItem[] the
 * backend replays for within-thread context. Pure — callers pass exactly the
 * messages they want replayed (typically excluding the current turn, which is
 * sent separately as `message`).
 *
 * Extracted from ChatComponent so BOTH the main thread and side threads build
 * history identically. Side-thread isolation falls out of WHICH messages a
 * caller passes — a main request never includes branch turns, so the agent
 * cannot see them until they are merged back in.
 *
 * Rules (unchanged from the original ChatComponent.buildHistory):
 *  - keep user/assistant turns with non-empty text
 *  - keep tool turns that carry a toolName or toolResult
 *  - cap to the last HISTORY_CAP conversational turns
 *  - strip imageDataUrl from all but the IMAGE_CAP most-recent image-bearing turns
 */
export function buildHistory(
  messages: ChatMessage[],
  opts: { historyCap?: number; imageCap?: number } = {},
): ChatHistoryItem[] {
  const historyCap = opts.historyCap ?? HISTORY_CAP;
  const imageCap = opts.imageCap ?? IMAGE_CAP;

  const raw: ChatHistoryItem[] = messages.flatMap((m): ChatHistoryItem[] => {
    if (m.role === 'user' && m.text.trim().length > 0) {
      return [
        {
          role: 'user',
          text: m.text,
          ...(m.imageDataUrl ? { imageDataUrl: m.imageDataUrl } : {}),
        },
      ];
    }
    if (m.role === 'assistant' && m.text.trim().length > 0) {
      return [{ role: 'assistant', text: m.text }];
    }
    if (m.role === 'tool' && (m.toolName || m.toolResult)) {
      return [
        {
          role: 'tool',
          text: '',
          ...(m.toolName ? { toolName: m.toolName } : {}),
          ...(m.toolArgs ? { toolArgs: m.toolArgs } : {}),
          ...(m.toolResult ? { toolResult: m.toolResult } : {}),
        },
      ];
    }
    return [];
  });

  // Cap conversational (user/assistant) turns to the last `historyCap`.
  let convCount = 0;
  let cutIdx = raw.length;
  for (let i = raw.length - 1; i >= 0; i--) {
    if (raw[i].role === 'user' || raw[i].role === 'assistant') {
      convCount++;
      if (convCount === historyCap) {
        cutIdx = i;
        break;
      }
    }
  }
  const capped = raw.slice(cutIdx === raw.length ? 0 : cutIdx);

  // Strip imageDataUrl beyond the `imageCap` most-recent image-bearing user turns.
  let imgCount = 0;
  for (let i = capped.length - 1; i >= 0; i--) {
    if (capped[i].role === 'user' && capped[i].imageDataUrl) {
      imgCount++;
      if (imgCount > imageCap) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { imageDataUrl: _, ...rest } = capped[i];
        capped[i] = rest;
      }
    }
  }

  return capped;
}
