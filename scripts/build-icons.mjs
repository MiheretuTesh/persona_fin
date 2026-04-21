#!/usr/bin/env node
// Rasterize brand SVGs to the PNG assets Expo expects.
// Run: npm run icons   (after `npm install` installs `sharp`).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(here, '..', 'assets');
const brand = join(assetsDir, 'brand');

const renders = [
  { src: 'icon-source.svg', out: 'icon.png', width: 1024, height: 1024, fit: 'cover' },
  { src: 'icon-source.svg', out: 'adaptive-icon.png', width: 1024, height: 1024, fit: 'cover', background: '#080e1a' },
  { src: 'icon-source.svg', out: 'favicon.png', width: 64, height: 64, fit: 'cover' },
  { src: 'icon-source.svg', out: 'notification-icon.png', width: 96, height: 96, fit: 'cover' },
  { src: 'splash-source.svg', out: 'splash.png', width: 1242, height: 2688, fit: 'contain', background: '#080e1a' },
];

await mkdir(assetsDir, { recursive: true });

for (const r of renders) {
  const svg = await readFile(join(brand, r.src));
  const pipeline = sharp(svg, { density: 384 }).resize({
    width: r.width,
    height: r.height,
    fit: r.fit,
    background: r.background ?? { r: 8, g: 14, b: 26, alpha: 1 },
  });
  const png = await pipeline.png({ compressionLevel: 9 }).toBuffer();
  await writeFile(join(assetsDir, r.out), png);
  console.log(`  ✓ assets/${r.out}  (${r.width}×${r.height})`);
}
