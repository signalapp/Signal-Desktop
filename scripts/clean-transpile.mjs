// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import fastGlob from 'fast-glob';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

const repoRoot = join(import.meta.dirname, '..');

const PATTERNS = [
  'sticker-creator/dist',
  'build/**/*.js',
  'app/**/*.js',
  'app/*.js',
  'ts/**/*.js',
  'bundles',
  'tsconfig.tsbuildinfo',
  'preload.bundle.js',
  'preload.bundle.cache',
];

const EXCEPTIONS = new Set(['ts/windows/main/tsx.preload.js']);

const readable = fastGlob.stream(PATTERNS, {
  cwd: repoRoot,
});

const promises = [];
let count = 0;
for await (const entry of readable) {
  if (typeof entry !== 'string') {
    throw new Error('Expected readable entry to be string');
  }
  if (EXCEPTIONS.has(entry)) {
    continue;
  }
  count += 1;
  promises.push(rm(entry, { recursive: true, force: true }));
}
await Promise.all(promises);

console.log(`Deleted ${count} files`);
