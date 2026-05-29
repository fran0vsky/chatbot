import { describe, it, expect } from 'vitest';
import { updateElo, DEFAULT_RATING, K_FACTOR } from './elo.js';

describe('updateElo', () => {
  describe('constants', () => {
    it('exports DEFAULT_RATING = 1000', () => {
      expect(DEFAULT_RATING).toBe(1000);
    });

    it('exports K_FACTOR = 24', () => {
      expect(K_FACTOR).toBe(24);
    });
  });

  describe('equal ratings (1000 vs 1000)', () => {
    it('winner gains points and loser loses the same amount', () => {
      const { ra, rb } = updateElo(1000, 1000, 'a');
      expect(ra).toBeGreaterThan(1000);
      expect(rb).toBeLessThan(1000);
    });

    it('result is symmetric: same delta magnitude for winner and loser', () => {
      const { ra: ra1, rb: rb1 } = updateElo(1000, 1000, 'a');
      const winDelta = ra1 - 1000;
      const loseDelta = 1000 - rb1;
      expect(winDelta).toBe(loseDelta);
    });

    it('draw from equal ratings leaves both ratings unchanged (within rounding)', () => {
      const { ra, rb } = updateElo(1000, 1000, 'draw');
      // At equal ratings Ea = Eb = 0.5, so K*(0.5-0.5) = 0 — no movement.
      expect(ra).toBe(1000);
      expect(rb).toBe(1000);
    });

    it('winner gains K/2 points at equal ratings', () => {
      const { ra } = updateElo(1000, 1000, 'a');
      // Ea = 0.5, Sa = 1 → delta = K * (1 - 0.5) = K/2 = 12
      expect(ra).toBe(1000 + K_FACTOR / 2);
    });
  });

  describe('symmetry: A wins vs B wins', () => {
    it('ra from A-wins equals rb from B-wins (mirror game)', () => {
      const aWins = updateElo(1000, 1200, 'a');
      const bWins = updateElo(1200, 1000, 'b');
      // When A wins from (1000,1200) — A's new rating should equal B's new
      // rating when B wins from (1200,1000) because the lower-rated dino won.
      expect(aWins.ra).toBe(bWins.rb);
    });

    it('draw is perfectly symmetric', () => {
      const { ra, rb } = updateElo(1100, 900, 'draw');
      // Higher-rated A loses expected value on draw, lower-rated B gains.
      expect(ra).toBeLessThan(1100);
      expect(rb).toBeGreaterThan(900);
      // Check mirror: swap and draw again
      const mirror = updateElo(900, 1100, 'draw');
      expect(mirror.ra).toBe(rb);
      expect(mirror.rb).toBe(ra);
    });
  });

  describe('expected-score monotonicity', () => {
    it('higher-rated dino gains less when winning', () => {
      const { ra: raFavorite } = updateElo(1400, 1000, 'a');
      const { ra: raUnderdog } = updateElo(1000, 1400, 'a');
      const favoriteDelta = raFavorite - 1400;
      const underdogDelta = raUnderdog - 1000;
      expect(favoriteDelta).toBeLessThan(underdogDelta);
    });

    it('higher-rated dino loses more when losing to lower-rated', () => {
      const { ra: raFavorite } = updateElo(1400, 1000, 'b');
      const lossDelta = 1400 - raFavorite;
      // Favorite loses; delta should be large (close to K) since it was unexpected.
      expect(lossDelta).toBeGreaterThan(K_FACTOR / 2);
    });
  });

  describe('draw / tie handling', () => {
    it('draw splits points: higher-rated loses, lower-rated gains', () => {
      const { ra, rb } = updateElo(1200, 800, 'draw');
      expect(ra).toBeLessThan(1200);
      expect(rb).toBeGreaterThan(800);
    });

    it('draw from equal ratings is zero-sum (no change)', () => {
      const { ra, rb } = updateElo(1500, 1500, 'draw');
      expect(ra).toBe(1500);
      expect(rb).toBe(1500);
    });
  });

  describe('win / loss', () => {
    it('B-win: B gains and A loses', () => {
      const { ra, rb } = updateElo(1000, 1000, 'b');
      expect(rb).toBeGreaterThan(1000);
      expect(ra).toBeLessThan(1000);
    });

    it('ratings are always positive integers', () => {
      const { ra, rb } = updateElo(100, 3000, 'b');
      expect(ra).toBeGreaterThan(0);
      expect(Number.isInteger(ra)).toBe(true);
      expect(Number.isInteger(rb)).toBe(true);
    });

    it('very lopsided upset gives large delta', () => {
      const { ra } = updateElo(600, 2000, 'a'); // massive underdog wins
      // Ea ≈ 1/(1+10^((2000-600)/400)) ≈ ~0. Delta ≈ K*1 = 24.
      expect(ra - 600).toBeCloseTo(K_FACTOR, 0);
    });
  });

  describe('documented formula correctness', () => {
    it('computes exact expected score for 200-point difference', () => {
      // Ea = 1/(1+10^(200/400)) = 1/(1+10^0.5) ≈ 1/4.162 ≈ 0.2401
      const { ra } = updateElo(800, 1000, 'a');
      const ea = 1 / (1 + Math.pow(10, (1000 - 800) / 400));
      const expected = Math.round(800 + K_FACTOR * (1 - ea));
      expect(ra).toBe(expected);
    });
  });
});
