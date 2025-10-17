// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as child from 'node:child_process';
import createDebug from 'debug';

const debug = createDebug('mock:test:calling:helpers');

export function runTurnInContainer(): void {
  tearDownTurnContainer();
  const result = child.spawnSync('docker', [
    'run',
    '--name',
    'coturn',
    '-d',
    '--network=host',
    'coturn/coturn',
  ]);
  debug(
    'create coturn: signal: ',
    result.signal,
    ' status: ',
    result.status,
    'stderr: ',
    result.stderr?.toString()
  );
}

export function tearDownTurnContainer(): void {
  debug('tearDownTurnContainer');
  child.spawnSync('docker', ['rm', '--force', '--volumes', 'coturn']);
}
