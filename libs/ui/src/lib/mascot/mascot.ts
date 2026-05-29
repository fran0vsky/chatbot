import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';

export type MascotSize = 'sm' | 'hero';
export type MascotTheme = 'day' | 'night';

@Component({
  standalone: true,
  selector: 'app-mascot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mascot.html',
})
export class Mascot {
  /** Visual size. */
  @Input() size: MascotSize = 'sm';

  /**
   * When set, the mascot renders this dino's pixel-art species asset
   * (`/spino/dinos/{dinoId}-{theme}.png`) instead of the generic Spino SVG.
   * If the asset is missing (not yet drawn), it falls back to the Spino SVG.
   */
  @Input()
  set dinoId(value: string | undefined) {
    if (value !== this._dinoId) this.assetFailed.set(false);
    this._dinoId = value;
  }
  get dinoId(): string | undefined {
    return this._dinoId;
  }
  private _dinoId?: string;

  /**
   * Optional explicit theme. When omitted, both day and night variants are
   * rendered and the global `.night-mode` (Tailwind `dark:`) class decides
   * which is visible — so the mascot auto-syncs with the app theme.
   */
  @Input() theme?: MascotTheme;

  /** Flips to the Spino SVG fallback when a dino asset fails to load. */
  readonly assetFailed = signal(false);

  assetSrc(theme: MascotTheme): string {
    return `/spino/dinos/${this._dinoId}-${theme}.png`;
  }

  onAssetError(): void {
    this.assetFailed.set(true);
  }
}
