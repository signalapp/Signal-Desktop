// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { readdir, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';

async function main(): Promise<void> {
  const rootDir = join(__dirname, '..', '..');
  const sourceDir = join(rootDir, '_locales');
  const targetDir = join(rootDir, 'build', 'compact-locales');

  const locales = await readdir(sourceDir);

  await Promise.all(
    locales.map(async locale => {
      const sourcePath = join(sourceDir, locale, 'messages.json');
      const targetPath = join(targetDir, locale, 'messages.json');

      await mkdir(dirname(targetPath), { recursive: true });

      const json = JSON.parse(await readFile(sourcePath, 'utf8'));
      for (const value of Object.values(json)) {
        const typedValue = value as { description?: string };
        delete typedValue.description;
      }
      delete json.smartling;

      const entries = [...Object.entries(json)];

      // Sort entries alphabetically for better incremental updates.
      entries.sort(([a], [b]) => {
        return a < b ? -1 : 1;
      });

      const result = Object.fromEntries(entries);
      await writeFile(targetPath, JSON.stringify(result));
    })
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
