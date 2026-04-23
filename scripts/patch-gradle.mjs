#!/usr/bin/env node
// Re-apply Gradle heap + parallelism settings after `expo prebuild` regenerates
// android/gradle.properties. Idempotent — safe to run repeatedly.
//
// Why this exists: Expo's prebuild template ships with `org.gradle.jvmargs=-Xmx2g`,
// which OOMs on RN 0.76 new-arch builds during :app:collectReleaseDependencies.
// 8g is safe on any modern Mac; adjust if your machine has less RAM.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'android', 'gradle.properties');

if (!existsSync(path)) {
  console.log('patch-gradle: no android/gradle.properties yet — run `expo prebuild` first, then retry.');
  process.exit(0);
}

const WANT = {
  'org.gradle.jvmargs':
    '-Xmx8g -XX:MaxMetaspaceSize=1g -XX:+UseParallelGC -Dfile.encoding=UTF-8',
  'kotlin.daemon.jvmargs': '-Xmx4g -XX:MaxMetaspaceSize=512m',
  'org.gradle.parallel': 'true',
  'org.gradle.caching': 'true',
  'org.gradle.daemon': 'true',
};

let text = readFileSync(path, 'utf8');
let changed = false;

for (const [key, value] of Object.entries(WANT)) {
  const re = new RegExp(`^(?:# *)?${key.replace(/\./g, '\\.')}=.*$`, 'm');
  const nextLine = `${key}=${value}`;
  if (re.test(text)) {
    const replaced = text.replace(re, nextLine);
    if (replaced !== text) { text = replaced; changed = true; }
  } else {
    text += (text.endsWith('\n') ? '' : '\n') + nextLine + '\n';
    changed = true;
  }
}

if (changed) {
  writeFileSync(path, text);
  console.log('patch-gradle: ✓ applied Gradle heap/parallel settings');
} else {
  console.log('patch-gradle: already up to date');
}
