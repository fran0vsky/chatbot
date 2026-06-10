const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC_DIR = path.resolve(__dirname, '..', 'apps', 'frontend', 'public', 'spino');
const SOURCE = path.join(SRC_DIR, 'dual-mascot.png');

// Per-dino mascots live under spino/dinos. Stacked source art (day over night
// on black) goes in dinos/_src/{id}-dual.png and is split into
// dinos/{id}-day.png + dinos/{id}-night.png by the same keying logic as Spino.
const DINOS_DIR = path.join(SRC_DIR, 'dinos');
const DINOS_SRC_DIR = path.join(DINOS_DIR, '_src');

// A pixel counts as "background" only if its channel sum is below this AND it is
// reachable from an image edge (see floodKeyBackground). Interior dark pixels —
// claws, deep shadows, eye sockets — stay fully opaque.
const BG_SUM_THRESHOLD = 70;

/**
 * Split one stacked dual-mascot image (day half on top, night half on bottom,
 * on a black background) into two background-keyed, trimmed PNGs.
 */
async function splitDual(source, dayOut, nightOut) {
  const meta = await sharp(source).metadata();
  const { width, height } = meta;
  if (!width || !height) throw new Error(`Could not read image dimensions: ${source}`);

  const halfHeight = Math.floor(height / 2);
  console.log(
    `${path.basename(source)}: ${width}x${height} -> two halves of ${width}x${halfHeight}`,
  );

  await processHalf(source, { left: 0, top: 0, width, height: halfHeight }, dayOut, 'day');
  await processHalf(
    source,
    { left: 0, top: halfHeight, width, height: height - halfHeight },
    nightOut,
    'night',
  );
}

/**
 * Remove the solid-black background by flood-filling inward from the image
 * edges over near-black pixels. Only background-connected black is keyed to
 * transparent; interior dark pixels (claws, shadows, eye sockets) keep their
 * alpha. This replaces the old per-pixel threshold + partial-alpha pass, which
 * punched holes through richly shaded sprites whose dark scales fell under the
 * darkness cutoff.
 */
function floodKeyBackground(pixels, width, height, channels) {
  const total = width * height;
  const isDark = new Uint8Array(total);
  for (let p = 0, i = 0; p < total; p++, i += channels) {
    if (pixels[i] + pixels[i + 1] + pixels[i + 2] < BG_SUM_THRESHOLD) isDark[p] = 1;
  }

  const isBg = new Uint8Array(total);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const p = y * width + x;
    if (isDark[p] && !isBg[p]) {
      isBg[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length) {
    const p = stack.pop();
    const x = p % width;
    const y = (p - x) / width;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }

  let keyedCount = 0;
  for (let p = 0; p < total; p++) {
    if (isBg[p]) {
      pixels[p * channels + 3] = 0;
      keyedCount++;
    }
  }
  return keyedCount;
}

async function processHalf(source, region, output, label) {
  const { data, info } = await sharp(source)
    .extract(region)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8ClampedArray(data);
  const { width, height, channels } = info;
  const keyedCount = floodKeyBackground(pixels, width, height, channels);

  await sharp(Buffer.from(pixels), { raw: { width, height, channels } })
    .trim({ threshold: 1 })
    .png()
    .toFile(output);

  const pct = ((keyedCount / (width * height)) * 100).toFixed(1);
  console.log(`  ${label}: keyed ${pct}% of pixels to transparent -> ${path.basename(output)}`);
}

/** Split the original single Spino dual-mascot.png. */
async function splitSpino() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source not found: ${SOURCE}`);
    console.error(`Save the combined dual-dino image as dual-mascot.png in that folder.`);
    process.exit(1);
  }
  await splitDual(SOURCE, path.join(SRC_DIR, 'mascot-day.png'), path.join(SRC_DIR, 'mascot-night.png'));
}

/** Resolve the _src path for a dino id. */
function dinoSourcePath(id) {
  return path.join(DINOS_SRC_DIR, `${id}-dual.png`);
}

/** Split one dino's _src/{id}-dual.png into dinos/{id}-day.png + dinos/{id}-night.png. */
async function splitDino(id) {
  const source = dinoSourcePath(id);
  if (!fs.existsSync(source)) {
    console.error(`No source art for "${id}": expected ${source}`);
    console.error(`Drop a stacked dual mascot there (day over night on black) and retry.`);
    process.exit(1);
  }
  fs.mkdirSync(DINOS_DIR, { recursive: true });
  await splitDual(
    source,
    path.join(DINOS_DIR, `${id}-day.png`),
    path.join(DINOS_DIR, `${id}-night.png`),
  );
}

/** Split every dinos/_src/*-dual.png found. */
async function splitAllDinos() {
  if (!fs.existsSync(DINOS_SRC_DIR)) {
    console.log(`No dino source folder yet (${DINOS_SRC_DIR}).`);
    console.log(`Create it and add {id}-dual.png files, then re-run.`);
    return;
  }
  const sources = fs
    .readdirSync(DINOS_SRC_DIR)
    .filter((f) => f.toLowerCase().endsWith('-dual.png'));

  if (sources.length === 0) {
    console.log(`No *-dual.png source art found in ${DINOS_SRC_DIR}.`);
    return;
  }

  fs.mkdirSync(DINOS_DIR, { recursive: true });
  for (const file of sources) {
    const id = file.replace(/-dual\.png$/i, '');
    await splitDual(
      path.join(DINOS_SRC_DIR, file),
      path.join(DINOS_DIR, `${id}-day.png`),
      path.join(DINOS_DIR, `${id}-night.png`),
    );
  }
  console.log(`\nSplit ${sources.length} dino mascot(s).`);
}

async function run() {
  const arg = process.argv[2];

  if (!arg) {
    // Backwards compatible: split the original Spino dual-mascot.png.
    await splitSpino();
  } else if (arg === '--all') {
    // Split every dino source. (Run with no arg for the Spino itself.)
    await splitAllDinos();
  } else {
    // Treat the arg as a single dino id.
    await splitDino(arg);
  }

  console.log('\nDone. Run `node scripts/optimize-spino-assets.js` next to resize for the app.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
