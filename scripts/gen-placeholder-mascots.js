/**
 * PLACEHOLDER generator — NOT final art.
 *
 * Produces a stacked dual-mascot source PNG per dino at
 * apps/frontend/public/spino/dinos/_src/{id}-dual.png so the rest of the
 * pipeline (split-mascot.js + optimize-spino-assets.js) and the UI wiring can
 * be exercised before the real pixel-art exists.
 *
 * Each placeholder is the Spino silhouette tinted with that dino's palette
 * (warm day on top, cooler night on the bottom, on solid black for keying).
 * The four dinos are distinguished by hue; the card/header also label them by
 * name + species, so identical silhouettes are fine for a placeholder.
 *
 * Replace these with real per-species pixel-art — see the deferred todo and
 * apps/frontend/public/spino/dinos/_src/README.md. Re-run with:
 *   node scripts/gen-placeholder-mascots.js
 *   node scripts/split-mascot.js --all
 *   node scripts/optimize-spino-assets.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC_DIR = path.resolve(__dirname, '..', 'apps', 'frontend', 'public', 'spino', 'dinos', '_src');

// Colors are kept bright (min channel > the splitter's keying threshold) so the
// silhouette survives the black-keying instead of being turned transparent.
const DINOS = [
  { id: 'rexford', day: '#5cc25c', night: '#5ec2b0' },
  { id: 'veloce', day: '#e0a64b', night: '#5bb0c2' },
  { id: 'glyphos', day: '#6f9ad6', night: '#5f86c2' },
  { id: 'nimbus', day: '#a98cd6', night: '#7d8cd6' },
];

const HALF = 320; // px per half (day on top, night on bottom)
const W = 320;

// Spino silhouette (from the Mascot component), viewBox 0 0 64 64.
function silhouette(fill) {
  return `
    <g fill="${fill}">
      <ellipse cx="32" cy="44" rx="20" ry="9" />
      <polygon points="48,42 62,52 58,54 46,46" />
      <path d="M16,38 Q22,18 32,16 Q42,18 48,38 L46,38 Q40,24 32,22 Q24,24 18,38 Z" fill-opacity="0.85" />
      <ellipse cx="18" cy="32" rx="6" ry="8" />
      <polygon points="4,30 18,28 18,36 6,34" />
      <ellipse cx="24" cy="52" rx="3" ry="4" />
      <ellipse cx="38" cy="52" rx="4" ry="5" />
    </g>`;
}

function half(dino, theme) {
  const scale = 4.6; // 64 * 4.6 ≈ 294; trim() crops to the silhouette afterward
  const fill = dino[theme];
  return `
    <g transform="translate(13, -10) scale(${scale})">
      ${silhouette(fill)}
    </g>`;
}

async function gen(dino) {
  const svg = `<svg width="${W}" height="${HALF * 2}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${HALF * 2}" fill="#000000" />
    <g transform="translate(0,0)">${half(dino, 'day')}</g>
    <g transform="translate(0,${HALF})">${half(dino, 'night')}</g>
  </svg>`;

  const out = path.join(SRC_DIR, `${dino.id}-dual.png`);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log(`placeholder -> ${path.relative(process.cwd(), out)}`);
}

async function run() {
  fs.mkdirSync(SRC_DIR, { recursive: true });
  for (const dino of DINOS) {
    await gen(dino);
  }
  console.log(`\nGenerated ${DINOS.length} placeholder source(s). Now run:`);
  console.log('  node scripts/split-mascot.js --all');
  console.log('  node scripts/optimize-spino-assets.js');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
