// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';

const ROOT_DIR = join(__dirname, '..', '..');

const ELECTRON = join(
  ROOT_DIR,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron.cmd' : 'electron'
);

async function main(): Promise<void> {
  const storagePath = await mkdtemp(join(tmpdir(), 'signal-preload-cache-'));

  let status: number | null;
  try {
    ({ status } = spawnSync(
      ELECTRON,
      ['--js-args="--predictable --random-seed 1"', 'ci.js'],
      {
        cwd: ROOT_DIR,
        env: {
          ...process.env,
          GENERATE_PRELOAD_CACHE: 'on',
          SIGNAL_CI_CONFIG: JSON.stringify({
            storagePath,
          }),
        },
        // Since we run `.cmd` file on Windows - use shell
        shell: process.platform === 'win32',
      }
    ));
  } finally {
    await rm(storagePath, { recursive: true });
  }

  if (status !== 0) {
    throw new Error(`Exit code: ${status}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
