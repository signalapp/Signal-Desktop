// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, mkdtemp, rm, rename } from 'node:fs/promises';
import pTimeout from 'p-timeout';

import { MINUTE } from '../util/durations';
import { explodePromise } from '../util/explodePromise';

const ROOT_DIR = join(__dirname, '..', '..');

const ELECTRON = join(
  ROOT_DIR,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron.cmd' : 'electron'
);

async function main(): Promise<void> {
  const storagePath = await mkdtemp(join(tmpdir(), 'signal-preload-cache-'));

  const proc = spawn(
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
  );

  try {
    const { promise, resolve, reject } = explodePromise<number | null>();
    proc.on('exit', status => resolve(status));
    proc.on('error', error => reject(error));

    const status = await pTimeout(promise, 5 * MINUTE);

    if (status !== 0) {
      throw new Error(`Exit code: ${status}`);
    }
  } catch (error) {
    const { ARTIFACTS_DIR } = process.env;
    if (!ARTIFACTS_DIR) {
      console.error(
        'Not saving artifacts. Please set ARTIFACTS_DIR env variable'
      );
    } else {
      console.error(`Saving logs to ${ARTIFACTS_DIR}`);
      await mkdir(ARTIFACTS_DIR, { recursive: true });

      const logsDir = join(storagePath, 'logs');
      await rename(logsDir, join(ARTIFACTS_DIR, 'logs'));
    }

    throw error;
  } finally {
    try {
      proc.kill();
    } catch {
      // Ignore
    }
    await rm(storagePath, { recursive: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
