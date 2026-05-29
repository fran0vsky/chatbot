const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC_DIR = path.resolve(__dirname, '..', 'apps', 'frontend', 'public', 'spino');
const DINOS_DIR = path.join(SRC_DIR, 'dinos');

const TARGETS = [
  { file: 'bg-day.png',       width: 1920, height: 1080, fit: 'cover',   quality: 85 },
  { file: 'bg-night.png',     width: 1920, height: 1080, fit: 'cover',   quality: 85 },
  { file: 'mascot-day.png',   width: 800,  height: 800,  fit: 'inside',  quality: 90, alpha: true, noPalette: true },
  { file: 'mascot-night.png', width: 800,  height: 800,  fit: 'inside',  quality: 90, alpha: true, noPalette: true },
  { file: 'spino-avatar.png', width: 256,  height: 256,  fit: 'contain', quality: 90, alpha: true },
  { file: 'spino-logo.png',   width: 128,  height: 128,  fit: 'contain', quality: 90, alpha: true },
];

// Per-dino mascots get the same treatment as the Spino mascot.
const DINO_TARGET = { width: 800, height: 800, fit: 'inside', quality: 90, alpha: true, noPalette: true };

async function optimize(srcPath, t) {
  const tmpPath = srcPath + '.tmp';
  const before = fs.statSync(srcPath).size;

  await sharp(srcPath)
    .resize(t.width, t.height, {
      fit: t.fit,
      background: t.alpha ? { r: 0, g: 0, b: 0, alpha: 0 } : undefined,
    })
    .png({ quality: t.quality, compressionLevel: 9, palette: !t.noPalette })
    .toFile(tmpPath);

  fs.renameSync(tmpPath, srcPath);
  const after = fs.statSync(srcPath).size;
  const pct = ((1 - after / before) * 100).toFixed(1);
  console.log(`${path.basename(srcPath).padEnd(22)} ${t.width}x${t.height}  ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB  (-${pct}%)`);
}

/** Collect the per-dino day/night PNGs produced by split-mascot.js (skips _src). */
function dinoMascotFiles() {
  if (!fs.existsSync(DINOS_DIR)) return [];
  return fs
    .readdirSync(DINOS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .map((f) => path.join(DINOS_DIR, f));
}

async function run() {
  for (const t of TARGETS) {
    const srcPath = path.join(SRC_DIR, t.file);
    if (!fs.existsSync(srcPath)) {
      console.log(`${t.file.padEnd(22)} (missing — skipped)`);
      continue;
    }
    await optimize(srcPath, t);
  }

  const dinoFiles = dinoMascotFiles();
  for (const srcPath of dinoFiles) {
    await optimize(srcPath, DINO_TARGET);
  }
  if (dinoFiles.length > 0) {
    console.log(`\nOptimized ${dinoFiles.length} per-dino mascot asset(s).`);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
