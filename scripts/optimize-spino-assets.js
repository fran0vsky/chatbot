const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC_DIR = path.resolve(__dirname, '..', 'apps', 'frontend', 'public', 'spino');

const TARGETS = [
  { file: 'bg-day.png',       width: 1920, height: 1080, fit: 'cover',   quality: 85 },
  { file: 'bg-night.png',     width: 1920, height: 1080, fit: 'cover',   quality: 85 },
  { file: 'mascot-day.png',   width: 768,  height: 1024, fit: 'cover',   quality: 90 },
  { file: 'mascot-night.png', width: 768,  height: 1024, fit: 'cover',   quality: 90 },
  { file: 'spino-avatar.png', width: 256,  height: 256,  fit: 'contain', quality: 90, alpha: true },
  { file: 'spino-logo.png',   width: 128,  height: 128,  fit: 'contain', quality: 90, alpha: true },
];

async function run() {
  for (const t of TARGETS) {
    const srcPath = path.join(SRC_DIR, t.file);
    const tmpPath = srcPath + '.tmp';
    const before = fs.statSync(srcPath).size;

    let pipeline = sharp(srcPath).resize(t.width, t.height, {
      fit: t.fit,
      background: t.alpha ? { r: 0, g: 0, b: 0, alpha: 0 } : undefined,
    });

    await pipeline
      .png({ quality: t.quality, compressionLevel: 9, palette: true })
      .toFile(tmpPath);

    fs.renameSync(tmpPath, srcPath);
    const after = fs.statSync(srcPath).size;
    const pct = ((1 - after / before) * 100).toFixed(1);
    console.log(`${t.file.padEnd(22)} ${t.width}x${t.height}  ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB  (-${pct}%)`);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
