// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { readdir, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import pMap from 'p-map';
import { isLocaleMessageType } from '../util/setupI18nMain.std.js';

async function compact({
  sourceDir,
  targetDir,
  locale,
  keys,
}: {
  sourceDir: string;
  targetDir: string;
  locale: string;
  keys: ReadonlyArray<string>;
}): Promise<ReadonlyArray<string>> {
  const sourcePath = join(sourceDir, locale, 'messages.json');
  const targetPath = join(targetDir, locale, 'values.json');

  await mkdir(dirname(targetPath), { recursive: true });

  const json = JSON.parse(await readFile(sourcePath, 'utf8'));

  const result = new Array<string | null>();
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

async function main(): Promise<void> {
  const rootDir = join(__dirname, '..', '..');
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

  await pMap(
    locales,
    locale => compact({ sourceDir, targetDir, locale, keys }),
    { concurrency: 10 }
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
