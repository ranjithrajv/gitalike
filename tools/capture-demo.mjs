/**
 * Capture a demo GIF of GitAlike's live preview drag divider.
 *
 * Loads the live preview page, simulates dragging the divider from
 * GitHub (default) to GitLab (skinned) and back, capturing frames
 * along the way. Outputs a GIF to docs/demo.gif.
 */
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const framesDir = join(root, 'docs', 'frames');
const outputGif = join(root, 'docs', 'demo.gif');
const previewUrl = 'https://ranjithrajv.github.io/gitalike/';

// Clean up old frames
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--disable-gpu', '--force-color-profile=srgb'],
});

const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
});

console.log('Loading preview page...');
await page.goto(previewUrl, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

// Find the drag handle
const handle = await page.$(
  '.divider, .slider-handle, [role="separator"], .drag-handle, .compare-handle',
);
if (!handle) {
  console.error('Could not find drag handle. Dumping page HTML...');
  const html = await page.content();
  console.log(html.slice(0, 3000));
  await browser.close();
  process.exit(1);
}

const box = await handle.boundingBox();
if (!box) {
  console.error('Could not get bounding box for handle');
  await browser.close();
  process.exit(1);
}

const startX = box.x + box.width / 2;
const startY = box.y + box.height / 2;

console.log(`Handle found at (${startX}, ${startY})`);

// Drag from center to right (GitHub → GitLab)
console.log('Capturing drag right (GitHub → GitLab)...');
await page.mouse.move(startX, startY);
await page.mouse.down();

const steps = 24;
for (let i = 1; i <= steps; i++) {
  const progress = i / steps;
  const x = startX + progress * 400;
  await page.mouse.move(x, startY, { steps: 2 });
  await page.waitForTimeout(50);
  const frameNum = String(i).padStart(3, '0');
  await page.screenshot({ path: join(framesDir, `frame-${frameNum}.png`) });
}

// Pause at GitLab side
for (let i = 0; i < 8; i++) {
  await page.screenshot({
    path: join(
      framesDir,
      `frame-${String(steps + i + 1).padStart(3, '0')}.png`,
    ),
  });
}

// Drag back to center (GitLab → GitHub)
console.log('Capturing drag back (GitLab → GitHub)...');
for (let i = 1; i <= steps; i++) {
  const progress = i / steps;
  const x = startX + 400 - progress * 400;
  await page.mouse.move(x, startY, { steps: 2 });
  await page.waitForTimeout(50);
  const frameNum = String(steps + 8 + i).padStart(3, '0');
  await page.screenshot({ path: join(framesDir, `frame-${frameNum}.png`) });
}

// Pause at GitHub side
for (let i = 0; i < 8; i++) {
  await page.screenshot({
    path: join(
      framesDir,
      `frame-${String(steps * 2 + 8 + i + 1).padStart(3, '0')}.png`,
    ),
  });
}

await page.mouse.up();
await browser.close();

console.log('Frames captured. Building GIF with ImageMagick...');

// Get frame dimensions from first frame
const firstFrame = join(framesDir, 'frame-001.png');
const identifyOut = execSync(`identify -format "%wx%h" ${firstFrame}`)
  .toString()
  .trim();
const [width, height] = identifyOut.split('x').map(Number);

// Build GIF with ImageMagick
// Resize to 640px wide for reasonable file size, use optimized palette
const frameFiles = readdirSync(framesDir)
  .filter((f) => f.endsWith('.png'))
  .sort()
  .map((f) => join(framesDir, f));

console.log(
  `Building GIF from ${frameFiles.length} frames at ${width}x${height}...`,
);

// Use ImageMagick to create an optimized GIF
// - Resize to 640w for web-friendly size
// - Use adaptive palette for quality
// - Optimize for file size
execSync(
  `convert ${frameFiles.join(' ')} \
  -resize 640x \
  -colors 128 \
  -set dispose Background \
  -loop 0 \
  -delay 8 \
  -layers OptimizeTransparency \
  -layers Optimize \
  ${outputGif}`,
  { stdio: 'inherit' },
);

// Check file size
const { statSync } = await import('node:fs');
const stats = statSync(outputGif);
console.log(`GIF created: ${outputGif} (${(stats.size / 1024).toFixed(1)} KB)`);

// Clean up frames
rmSync(framesDir, { recursive: true, force: true });
console.log('Cleaned up frames.');
