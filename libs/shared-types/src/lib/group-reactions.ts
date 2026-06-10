// --- Group-chat reaction vocabulary (single source of truth) ---
// One captioned emoji set shared by the backend orchestrator (which is told to
// pick reactions ONLY from this vocabulary) and the frontend (which renders the
// caption as a hover tooltip on each reaction chip). Keeping it in one place
// guarantees every emoji a dino reacts with always resolves to a tooltip.
//
// Captions are third-person predicates ("liked that") so they read naturally as
// "<Dino> liked that" when a dino reacts to another's message.

/** Emoji → hover tooltip caption. */
export const REACTION_TOOLTIPS: Record<string, string> = {
  // Core
  '👍': 'liked that',
  '❤️': 'loved that',
  '👎': 'disliked that',
  '😂': 'found that hilarious',
  '🤔': 'is thinking about that',
  '💡': "thought that's clever",
  '🎯': 'agreed completely',
  '🔥': "thought that's brilliant",
  '⚡': 'got inspired by that',
  '👀': 'is paying attention',
  // AI-specific
  '🧠': 'found that insightful',
  '📈': "thinks that's a strong argument",
  '🔬': 'wants to analyze that further',
  '🧩': 'connected the dots',
  '🎓': 'learned something new',
  '💭': 'is considering that idea',
  '🏆': "thinks that's the best answer so far",
  '🚀': 'wants to build on that',
  '✨': 'found that elegant',
  '⚙️': 'thinks that would work well',
  // Debate / multi-agent
  '🤨': 'is skeptical of that',
  '❓': 'has questions about that',
  '⚔️': 'disagrees with that',
  '🛑': "thinks that's incorrect",
  '🔄': 'suggests another approach',
  '📌': "thinks that's important",
  '🎭': 'sees it differently',
  '🧐': 'wants more evidence',
  // Artist / creative
  '🎨': 'appreciates the craft of that',
  // Character-rich
  '😎': 'thought that was cool',
  '🤯': 'was blown away by that',
  '😅': "wasn't expecting that",
  '🙌': 'fully supports that idea',
  '😬': 'felt uncertain about that',
  '🫡': 'respects that point',
  '😏': 'thinks they have a better idea',
  '😈': 'wants to challenge that',
};

/** The full set of allowed reaction emojis (insertion order preserved). */
export const REACTION_EMOJIS: readonly string[] = Object.keys(REACTION_TOOLTIPS);

/**
 * Default reaction for an image-generation dino in group chat. Image dinos
 * cannot surface their output in the group stream, so an `answer` slot would
 * render blank — the engine converts it to this react instead.
 */
export const ARTIST_DEFAULT_REACTION = '🎨';

/**
 * Resolve an emoji to its caption. Falls back to a neutral caption so an
 * unexpected emoji (e.g. an off-vocabulary model choice) still gets a tooltip.
 */
export function reactionTooltip(emoji: string | undefined): string {
  if (!emoji) return 'reacted';
  return REACTION_TOOLTIPS[emoji] ?? 'reacted';
}
