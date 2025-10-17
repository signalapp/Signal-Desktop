// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const MOCHA = join(__dirname, '..', '..', 'node_modules', '.bin', 'mocha');
const WORKER_COUNT = parseInt(process.env.WORKER_COUNT || '1', 10);
const WORKER_INDEX = parseInt(process.env.WORKER_INDEX || '0', 10);

const separator = process.argv.indexOf('--');
if (separator === -1) {
  throw new Error('Expected `--` separator between options and files');
}

const flags = process.argv.slice(2, separator);
const files = process.argv.slice(separator + 1);

const filteredFiles = files.filter((_file, index) => {
  return index % WORKER_COUNT === WORKER_INDEX;
});

console.log(`Running on ${filteredFiles.length}/${files.length} of files`);

const { status } = spawnSync(MOCHA, [...flags, ...filteredFiles], {
  stdio: 'inherit',
});

process.exit(status);
