// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import type { StdioOptions } from 'child_process';

import { MONTH } from '../util/durations';
import { isOlderThan } from '../util/timestamp';

const ROOT_DIR = path.join(__dirname, '..', '..');
const MESSAGES_FILE = path.join(ROOT_DIR, '_locales', 'en', 'messages.json');
const SPAWN_OPTS = {
  cwd: ROOT_DIR,
  stdio: [null, 'pipe', 'inherit'] as StdioOptions,
};

const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE).toString());

const stillUsed = new Set<string>();

for (const [key, value] of Object.entries(messages)) {
  const match = (value as Record<string, string>).description?.match(
    /\(\s*deleted\s+(\d{4}\/\d{2}\/\d{2})\s*\)/
  );
  if (!match) {
    continue;
  }

  const deletedAt = new Date(match[1]).getTime();
  if (!isOlderThan(deletedAt, MONTH)) {
    continue;
  }

  // Find uses in either:
  // - `i18n('key')`
  // - `<Intl id="key"/>`
  const { status, stdout } = spawnSync(
    'git',
    ['grep', '--extended-regexp', `'${key}'|id="${key}"`],
    SPAWN_OPTS
  );

  // Match found
  if (status === 0) {
    console.error(
      `ERROR: String is still used: "${key}", deleted on ${match[1]}`
    );
    console.error(stdout.toString().trim());
    console.error('');
    stillUsed.add(key);
  } else {
    console.log(`Removing string: "${key}", deleted on ${match[1]}`);
    delete messages[key];
  }
}

if (stillUsed.size !== 0) {
  console.error(
    `ERROR: Didn't remove ${[...stillUsed]} strings because of errors above`
  );
  console.error('ERROR: Not saving changes');
  process.exit(1);
}
fs.writeFileSync(MESSAGES_FILE, `${JSON.stringify(messages, null, 2)}\n`);
