// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import chalk from 'chalk';
import execa from 'execa';
import fs from 'node:fs/promises';
import pLimit from 'p-limit';
import path from 'node:path';
import { DAY } from './utils/durations.mjs';
import { DELETED_REGEXP } from './utils/intlMessages.mjs';
import { assert } from './utils/assert.mjs';

const ROOT_DIR = path.join(import.meta.dirname, '..');
const MESSAGES_FILE = path.join(ROOT_DIR, '_locales', 'en', 'messages.json');

const MAX_AGE = 30 * DAY;

const limitter = pLimit(10);

const removeBefore = Date.now() - MAX_AGE;

const messages = JSON.parse(await fs.readFile(MESSAGES_FILE, 'utf-8'));

/** @type {Set<string>} */
const stillUsed = new Set();

await Promise.all(
  Object.keys(messages).map(key =>
    limitter(async () => {
      /** @type {{ description?: string }} */
      const value = messages[key];

      const match = value.description?.match(DELETED_REGEXP);
      if (!match) {
        return;
      }

      const deletedAtStr = match[1];
      assert(deletedAtStr != null, 'Missing deletedAtStr');
      const deletedAt = new Date(deletedAtStr).getTime();
      if (deletedAt <= removeBefore) {
        return;
      }

      // Find uses in either:
      // - `i18n('key')`
      // - `<I18n id="key"/>`

      try {
        const result = await execa(
          'git',
          // prettier-ignore
          [
            'grep',
            '--extended-regexp',
            `'${key}'|id="${key}"`,
            '--',
            '**',
            ':!\\_locales/**',
            ':!\\sticker-creator/**',
          ],
          {
            cwd: ROOT_DIR,
            stdin: 'ignore',
            stdout: 'pipe',
            stderr: 'inherit',
          }
        );

        // Match found
        console.error(
          chalk.red(
            `ERROR: String is still used: "${key}", deleted on ${match[1]}`
          )
        );
        console.error(result.stdout.trim());
        console.error('');
        stillUsed.add(key);
      } catch (error) {
        if (error.exitCode === 1) {
          console.log(
            chalk.dim(`Removing string: "${key}", deleted on ${match[1]}`)
          );
          delete messages[key];
        } else {
          throw error;
        }
      }
    })
  )
);

if (stillUsed.size !== 0) {
  console.error(
    `ERROR: Didn't remove ${stillUsed.size} strings because of errors above`,
    Array.from(stillUsed)
      .map(str => `- ${str}`)
      .join('\n')
  );
  console.error('ERROR: Not saving changes');
  process.exit(1);
}
await fs.writeFile(MESSAGES_FILE, `${JSON.stringify(messages, null, 2)}\n`);
