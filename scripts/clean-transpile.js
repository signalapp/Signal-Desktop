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
  let count = 0;
  for await (const entry of readable) {
    count += 1;
    promises.push(rm(entry, { recursive: true, force: true }));
  }
  await Promise.all(promises);

  console.log(`Deleted ${count} files`);
}

// oxlint-disable-next-line promise/prefer-await-to-then
main().catch(error => {
  console.error(error);
  process.exit(1);
});
