// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { DELETED_REGEXP } from './constants';

const rootDir = path.resolve(__dirname, '..', '..');
const messagesPath = path.join(rootDir, '_locales/en/messages.json');

function getIcuLikeStrings(): Set<string> {
  const { status, stdout } = spawnSync(
    'grep',
    [
      // Match 'icu:Example__Element--StateAnd123'
      '--extended-regexp',
      'icu:[a-zA-Z0-9_.-]+',
      // Each line should just be the ICU message name without any noise
      '--no-filename',
      '--only-matching',
      // Search in these folders
      '--recursive',
      'ts/',
      'app/',
      'js/',
    ],
    {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'inherit'],
      encoding: 'utf-8',
    }
  );
  if (status !== 0) {
    throw new Error(`grep failed with status ${status}`);
  }
  return new Set(stdout.trim().split('\n'));
}

function getDateStr(date: Date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

const dateStr = getDateStr(new Date());
const lines = getIcuLikeStrings();
const messages = JSON.parse(readFileSync(messagesPath, 'utf-8'));
let deletedCount = 0;
for (const key of Object.keys(messages)) {
  const message = messages[key];
  if (key === 'smartling') {
    continue;
  }
  if (message.ignoreUnused) {
    continue;
  }
  if (DELETED_REGEXP.test(message.description)) {
    continue;
  }
  if (!lines.has(key)) {
    deletedCount += 1;
    console.log(`Marking ${key} as deleted`);
    if (message.description) {
      message.description = `(Deleted ${dateStr}) ${message.description}`;
    } else {
      message.description = `(Deleted ${dateStr})`;
    }
  }
}
if (deletedCount === 0) {
  console.log('No strings to delete');
} else {
  writeFileSync(messagesPath, `${JSON.stringify(messages, null, 2)}\n`);
  console.log(`Marked ${deletedCount} strings as deleted`);
}
