// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { execFileSync } from 'child_process';
import { join } from 'path';

const ROOT_DIR = join(__dirname, '..', '..');

const ELECTRON = join(
  ROOT_DIR,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron.cmd' : 'electron'
);

const stdout = execFileSync(ELECTRON, [ROOT_DIR], {
  cwd: ROOT_DIR,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    TEST_QUIT_ON_COMPLETE: 'on',
  },
  encoding: 'utf8',
});

const match = stdout.match(/ci:test-electron:done=(.*)?\n/);

if (!match) {
  throw new Error('No test results were found in stdout');
}

const {
  passed,
  failed,
}: {
  passed: Array<string>;
  failed: Array<{ testName: string; error: string }>;
} = JSON.parse(match[1]);

const total = passed.length + failed.length;

for (const { testName, error } of failed) {
  console.error(`- ${testName}`);
  console.error(error);
  console.error('');
}

console.log(
  `Passed ${passed.length} | Failed ${failed.length} | Total ${total}`
);

if (failed.length !== 0) {
  process.exit(1);
}
