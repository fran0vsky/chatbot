const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC_DIR = path.resolve(__dirname, '..', 'apps', 'frontend', 'public', 'spino');
const SOURCE = path.join(SRC_DIR, 'dual-mascot.png');

const BLACK_THRESHOLD = 35;

async function run() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source not found: ${SOURCE}`);
    console.error(`Save the combined dual-dino image as dual-mascot.png in that folder.`);
    process.exit(1);
  }

  const image = sharp(SOURCE);
  const meta = await image.metadata();
  const { width, height } = meta;
  if (!width || !height) throw new Error('Could not read image dimensions');

  const halfHeight = Math.floor(height / 2);
  console.log(`Source: ${width}x${height}. Splitting into two halves of ${width}x${halfHeight}.`);

  await processHalf(SOURCE, { left: 0, top: 0, width, height: halfHeight }, path.join(SRC_DIR, 'mascot-day.png'), 'day');
  await processHalf(SOURCE, { left: 0, top: halfHeight, width, height: height - halfHeight }, path.join(SRC_DIR, 'mascot-night.png'), 'night');

  console.log('\nDone. Run `node scripts/optimize-spino-assets.js` next to resize for the app.');
}

async function processHalf(source, region, output, label) {
  const { data, info } = await sharp(source)
    .extract(region)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8ClampedArray(data);
  const channels = info.channels;
  let keyedCount = 0;

  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    if (r + g + b < BLACK_THRESHOLD * 3) {
      pixels[i + 3] = 0;
      keyedCount++;
    } else {
      const darkness = Math.min(r, g, b);
      if (darkness < BLACK_THRESHOLD * 2) {
        const alpha = Math.min(255, Math.floor((darkness / (BLACK_THRESHOLD * 2)) * 255));
        pixels[i + 3] = Math.min(pixels[i + 3], alpha);
      }
    }
  }

  await sharp(Buffer.from(pixels), { raw: { width: info.width, height: info.height, channels } })
    .trim({ threshold: 1 })
    .png()
    .toFile(output);

  const pct = ((keyedCount / (info.width * info.height)) * 100).toFixed(1);
  console.log(`  ${label}: keyed ${pct}% of pixels to transparent -> ${path.basename(output)}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
