#!/usr/bin/env node
// Quick sanity check before kicking off an EAS build.
// Run: `npm run preflight`
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
let ok = true;

function check(label, fn) {
  try {
    const r = fn();
    if (r === false) {
      ok = false;
      console.log(`  ✗ ${label}`);
    } else {
      console.log(`  ✓ ${label}${typeof r === 'string' ? ` — ${r}` : ''}`);
    }
  } catch (e) {
    ok = false;
    console.log(`  ✗ ${label} — ${e.message}`);
  }
}

console.log('Equilibrium build preflight');
console.log('────────────────────────────');

check('assets/icon.png exists', () => existsSync(join(root, 'assets/icon.png')) || 'run `npm run icons`');
check('assets/adaptive-icon.png exists', () => existsSync(join(root, 'assets/adaptive-icon.png')));
check('assets/splash.png exists', () => existsSync(join(root, 'assets/splash.png')));
check('eas.json exists', () => existsSync(join(root, 'eas.json')));

check('.env has EXPO_PUBLIC_SUPABASE_URL', () => {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return 'no .env — EAS Build will fail without Supabase credentials';
  const env = readFileSync(envPath, 'utf8');
  if (!/^EXPO_PUBLIC_SUPABASE_URL=.+/m.test(env)) return false;
  if (!/^EXPO_PUBLIC_SUPABASE_ANON_KEY=.+/m.test(env)) return false;
  return true;
});

const appJson = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
check(`android.package = ${appJson.expo.android?.package ?? '?'}`, () => !!appJson.expo.android?.package);
check(`android.versionCode = ${appJson.expo.android?.versionCode ?? '?'}`, () => typeof appJson.expo.android?.versionCode === 'number');
check(`ios.bundleIdentifier = ${appJson.expo.ios?.bundleIdentifier ?? '?'}`, () => !!appJson.expo.ios?.bundleIdentifier);

if (appJson.expo.extra?.eas?.projectId === 'replace-with-your-eas-project-id') {
  console.log('  ⚠  extra.eas.projectId is still the placeholder — run `eas init` to generate a real one');
}

console.log('────────────────────────────');
console.log(ok ? 'Ready to build.' : 'Fix the items above before running `eas build`.');
process.exit(ok ? 0 : 1);
