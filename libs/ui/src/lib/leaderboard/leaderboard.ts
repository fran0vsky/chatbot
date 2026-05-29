import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { LeaderboardRow } from '@org/shared-types';
import { Mascot } from '../mascot/mascot.js';

/**
 * Presentational leaderboard table for the Dino Arena.
 * Accepts a pre-sorted rows array and renders rank, mascot, name,
 * rating, W/L/D, and games. No services injected; no side-effects.
 *
 * Usage: `<app-leaderboard [rows]="leaderboardRows()" />`
 */
@Component({
  standalone: true,
  selector: 'app-leaderboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './leaderboard.html',
  imports: [Mascot],
})
export class Leaderboard {
  /** Pre-sorted leaderboard rows (rank 1 = index 0). */
  @Input() rows: LeaderboardRow[] = [];
}
