// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { readdir, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import pMap from 'p-map';

/**
 * @param {unknown} value
 * @returns {value is { messageformat: string }}
 */
function isLocaleMessageType(value) {
  return (
    typeof value === 'object' &&
    value != null &&
    Object.hasOwn(value, 'messageformat')
  );
}

/**
 * @param {object} options
 * @param {string} options.sourceDir
 * @param {string} options.targetDir
 * @param {string} options.locale
 * @param {ReadonlyArray<string>} options.keys
 * @returns {Promise<ReadonlyArray<string>>}
 */
async function compact({ sourceDir, targetDir, locale, keys }) {
  const sourcePath = join(sourceDir, locale, 'messages.json');
  const targetPath = join(targetDir, locale, 'values.json');

  await mkdir(dirname(targetPath), { recursive: true });

  const json = JSON.parse(await readFile(sourcePath, 'utf8'));

  /** @type {Array<string | null>} */
  const result = [];
  for (const key of keys) {
    if (json[key] == null) {
      // Pull English translation, or leave blank (string was deleted)
      result.push(null);
      continue;
    }

    const value = json[key];
    if (!isLocaleMessageType(value)) {
      continue;
    }
    if (value.messageformat == null) {
      continue;
    }
    result.push(value.messageformat);
  }

  await writeFile(targetPath, JSON.stringify(result));

  return keys;
}

const rootDir = join(import.meta.dirname, '..');
const sourceDir = join(rootDir, '_locales');
const targetDir = join(rootDir, 'build', 'compact-locales');

const locales = await readdir(sourceDir);

const allKeys = await pMap(
  locales,
  async locale => {
    const sourcePath = join(sourceDir, locale, 'messages.json');
    const json = JSON.parse(await readFile(sourcePath, 'utf8'));
    return Object.entries(json)
      .filter(([, value]) => isLocaleMessageType(value))
      .map(([key]) => key);
  },
  { concurrency: 10 }
);

// Sort keys alphabetically for better incremental updates.
const keys = Array.from(new Set(allKeys.flat())).sort();
await mkdir(targetDir, { recursive: true });
await writeFile(join(targetDir, 'keys.json'), JSON.stringify(keys));

await pMap(locales, locale => compact({ sourceDir, targetDir, locale, keys }), {
  concurrency: 10,
});
