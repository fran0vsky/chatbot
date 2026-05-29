/**
 * Shared arena types used by both backend and frontend.
 * Kept minimal — all game logic lives in the backend.
 */

/** Per-dino rating record as persisted in dino_ratings. */
export interface DinoRating {
  dinoId: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  games: number;
}

/** A vote cast by the user after watching an arena match. */
export interface ArenaVote {
  /** Optional: client-generated identifier for this match (not persisted). */
  promptId?: string;
  /** The dinoId assigned to panel A in this match. */
  aDinoId: string;
  /** The dinoId assigned to panel B in this match. */
  bDinoId: string;
  /** 'a' if A won, 'b' if B won, 'draw' for a tie. */
  result: 'a' | 'b' | 'draw';
}

/** A leaderboard row: DinoRating + display fields from the registry. */
export interface LeaderboardRow extends DinoRating {
  name: string;
  species: string;
}
