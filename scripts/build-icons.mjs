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

// `transparent: true` flips the render to keep alpha so the OS-provided
// splash backgroundColor (set in app.json) shows through. iOS rejects alpha
// in app icons (renders as black), so icon outputs always force a solid bg.
const TRANSPARENT_BG = { r: 0, g: 0, b: 0, alpha: 0 };
const SURFACE_BG = { r: 8, g: 14, b: 26, alpha: 1 };

const renders = [
  { src: 'icon-source.svg', out: 'icon.png', width: 1024, height: 1024, fit: 'cover' },
  { src: 'icon-source.svg', out: 'adaptive-icon.png', width: 1024, height: 1024, fit: 'cover', background: '#080e1a' },
  { src: 'icon-source.svg', out: 'favicon.png', width: 64, height: 64, fit: 'cover' },
  { src: 'icon-source.svg', out: 'notification-icon.png', width: 96, height: 96, fit: 'cover', transparent: true },
  // Splash: transparent square — Expo `resizeMode: contain` centers it and
  // fills the rest of the screen with `expo-splash-screen.backgroundColor`.
  { src: 'splash-source.svg', out: 'splash.png', width: 1024, height: 1024, fit: 'contain', transparent: true },
];

await mkdir(assetsDir, { recursive: true });

for (const r of renders) {
  const svg = await readFile(join(brand, r.src));
  const background = r.transparent
    ? TRANSPARENT_BG
    : (typeof r.background === 'string' ? r.background : (r.background ?? SURFACE_BG));
  const pipeline = sharp(svg, { density: 384 }).resize({
    width: r.width,
    height: r.height,
    fit: r.fit,
    background,
  });
  const png = await pipeline.png({ compressionLevel: 9 }).toBuffer();
  await writeFile(join(assetsDir, r.out), png);
  console.log(`  ✓ assets/${r.out}  (${r.width}×${r.height})${r.transparent ? '  · transparent bg' : ''}`);
}
