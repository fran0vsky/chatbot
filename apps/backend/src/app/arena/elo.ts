/**
 * Pure Elo rating update for the Dino Arena.
 *
 * System design:
 *  - Every dino starts at DEFAULT_RATING = 1000.
 *  - K_FACTOR = 24 (moderate volatility for a small roster).
 *  - Expected score for A vs B: Ea = 1 / (1 + 10^((Rb - Ra) / 400))
 *  - Result S: winner 1, loser 0, draw 0.5 each.
 *  - New rating: Ra' = Ra + K * (Sa - Ea) (and symmetrically for B).
 *  - "Tie" is treated as draw (Sa = Sb = 0.5).
 *
 * All functions are pure — no I/O, no side-effects.
 */

export const DEFAULT_RATING = 1000;

/**
 * K-factor controls how much a single match moves ratings.
 * 24 gives moderate volatility suited to a small roster.
 */
export const K_FACTOR = 24;

/** Result of a match from dino A's perspective. */
export type MatchResult = 'a' | 'b' | 'draw';

export interface EloUpdate {
  /** New rating for dino A. */
  ra: number;
  /** New rating for dino B. */
  rb: number;
}

/**
 * Compute the expected score for A given both current ratings.
 * Returns a value in (0, 1).
 */
function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

/**
 * Update Elo ratings for a match between dino A and dino B.
 *
 * @param ra   Current rating of dino A.
 * @param rb   Current rating of dino B.
 * @param result  'a' if A won, 'b' if B won, 'draw' for a tie.
 * @returns    New ratings for both dinos (rounded to nearest integer).
 */
export function updateElo(ra: number, rb: number, result: MatchResult): EloUpdate {
  const ea = expectedScore(ra, rb);
  const eb = 1 - ea; // expectedScore(rb, ra) is exactly 1 - ea

  let sa: number;
  let sb: number;

  switch (result) {
    case 'a':
      sa = 1;
      sb = 0;
      break;
    case 'b':
      sa = 0;
      sb = 1;
      break;
    case 'draw':
      sa = 0.5;
      sb = 0.5;
      break;
  }

  return {
    ra: Math.round(ra + K_FACTOR * (sa - ea)),
    rb: Math.round(rb + K_FACTOR * (sb - eb)),
  };
}
