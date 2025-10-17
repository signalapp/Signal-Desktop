// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, mkdtemp, rm, rename } from 'node:fs/promises';
import pTimeout from 'p-timeout';
import ELECTRON_BIN from 'electron';

import { MINUTE } from '../util/durations/index.std.js';
import { explodePromise } from '../util/explodePromise.std.js';

const ROOT_DIR = join(__dirname, '..', '..');

const V8_ARGS = ['--predictable'];

async function main(): Promise<void> {
  const storagePath = await mkdtemp(join(tmpdir(), 'signal-preload-cache-'));

  const argv = [`--js-flags=${V8_ARGS.join(' ')}`];
  if (process.platform === 'linux') {
    argv.push('--no-sandbox');
  }
  argv.push('ci.js');

  const proc = spawn(
    // When imported from Node.js - the default export of 'electron' is a path
    // to the Electron binary.
    ELECTRON_BIN as unknown as string,
    argv,
    {
      stdio: [null, 'inherit', 'inherit'],
      cwd: ROOT_DIR,
      env: {
        // Linux X11 support
        DISPLAY: process.env.DISPLAY,
        XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR,
        WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY,
        XAUTHORITY: process.env.XAUTHORITY,

        CI: process.env.CI ? 'on' : undefined,
        GENERATE_PRELOAD_CACHE: 'on',
        SIGNAL_CI_CONFIG: JSON.stringify({
          storagePath,
          openDevTools: false,
        }),
      },
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
