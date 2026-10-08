/* global process, console, Image, document, Buffer */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { URL } from 'node:url';

// Export the restored masters at their native resolution; no further upscaling.
const browser = await chromium.launch({ executablePath: process.env.LIFEGAME_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  for (const name of ['sidebar-coastal-city', 'mobile-footer-city']) {
    const source = await readFile(new URL(`../src/assets/masters/${name}.png`, import.meta.url));
    const result = await page.evaluate(async image => {
      const photo = new Image();
      photo.src = image;
      await photo.decode();
      const canvas = document.createElement('canvas');
      canvas.width = photo.naturalWidth;
      canvas.height = photo.naturalHeight;
      canvas.getContext('2d').drawImage(photo, 0, 0);
      return { image: canvas.toDataURL('image/webp', 0.98).split(',')[1], width: canvas.width, height: canvas.height };
    }, `data:image/png;base64,${source.toString('base64')}`);
    await writeFile(new URL(`../src/assets/${name}.webp`, import.meta.url), Buffer.from(result.image, 'base64'));
    console.log(`${name}: ${result.width} × ${result.height}, WebP quality 98%, master preserved.`);
  }
} finally { await browser.close(); }
