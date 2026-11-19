// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

if (process.platform !== 'win32') {
  process.stdout.write('Windows native tests skipped on this platform.\n');
} else {
  const cwd = resolve(import.meta.dirname, '..');
  mkdirSync(resolve(cwd, 'build'), { recursive: true });
  execFileSync(
    'cl.exe',
    [
      '/nologo',
      '/EHsc',
      '/std:c++17',
      '/W4',
      '/WX',
      'test/hour_cycle_test.cpp',
      '/Fobuild/hour_cycle_test.obj',
      '/Febuild/hour_cycle_test.exe',
    ],
    { cwd, stdio: 'inherit' },
  );
  execFileSync(resolve(cwd, 'build/hour_cycle_test.exe'), [], {
    cwd,
    stdio: 'inherit',
  });
}
