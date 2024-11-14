// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const fastGlob = require('fast-glob');
const { rm } = require('node:fs/promises');
const { join } = require('node:path');

const repoRoot = join(__dirname, '..');

const PATTERNS = [
  'sticker-creator/dist',
  'app/**/*.js',
  'app/*.js',
  'ts/**/*.js',
  'bundles',
  'tsconfig.tsbuildinfo',
  'preload.bundle.js',
  'preload.bundle.cache',
];

async function main() {
  const readable = fastGlob.stream(PATTERNS, {
    cwd: repoRoot,
  });

  const promises = [];
  for await (const entry of readable) {
    promises.push(rm(entry, { recursive: true, force: true }));
  }
  await Promise.all(promises);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
