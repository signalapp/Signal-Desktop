// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const FIXTURES = path.join(__dirname, '..', '..', 'fixtures');
const SIZE = 256 * 1024;

async function main() {
  const original = crypto.randomBytes(SIZE);

  const originalPath = path.join(FIXTURES, 'diff-original.bin');
  await fs.writeFile(originalPath, original);

  // Add a few broken bytes to help create useful blockmaps
  for (let i = 0; i < 3; i += 1) {
    original[Math.floor(Math.random() * original.length)] = 0;
  }

  const modifiedPath = path.join(FIXTURES, 'diff-modified.bin');
  await fs.writeFile(modifiedPath, original);

  const appBuilder = path.join(
    __dirname,
    '..',
    '..',
    'node_modules',
    'app-builder-bin',
    'mac',
    'app-builder_amd64'
  );

  for (const filePath of [originalPath, modifiedPath]) {
    console.log('Adding blockmap to', filePath);

    // Put blockmap into a separate file
    console.log(
      execFileSync(appBuilder, [
        'blockmap',
        '--input',
        filePath,
        '--output',
        `${filePath}.blockmap`,
      ]).toString()
    );
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
