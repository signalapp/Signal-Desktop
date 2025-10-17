// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import fs from 'node:fs/promises';
import path from 'node:path';
import fastGlob from 'fast-glob';
import * as LocaleMatcher from '@formatjs/intl-localematcher';

const ROOT_DIR = path.join(__dirname, '..', '..');

function matches(input: string, expected: string) {
  const match = LocaleMatcher.match([input], [expected], 'en', {
    algorithm: 'best fit',
  });
  return match === expected;
}

async function main() {
  const dirEntries = await fastGlob('_locales/*', {
    cwd: ROOT_DIR,
    onlyDirectories: true,
  });

  const localeDirNames = [];

  for (const dirEntry of dirEntries) {
    const dirName = path.basename(dirEntry);
    const locale = new Intl.Locale(dirName);

    // Smartling doesn't always use the correct language tag, so this check and
    // reverse check are to make sure we don't accidentally add a locale that
    // doesn't match its directory name (using LocaleMatcher).
    //
    // If this check ever fails, we may need to update our get-strings script to
    // manually rename language tags before writing them to disk.
    //
    // Such is the case for Smartling's "zh-YU" locale, which we renamed to
    // "yue" to match the language tag used by... everyone else.

    if (!matches(dirName, locale.baseName)) {
      throw new Error(
        `Matched locale "${dirName}" does not match its resolved name "${locale.baseName}"`
      );
    }
    if (!matches(locale.baseName, dirName)) {
      throw new Error(
        `Matched locale "${dirName}" does not match its dir name "${dirName}"`
      );
    }

    localeDirNames.push(dirName);
  }

  const jsonPath = path.join(ROOT_DIR, 'build', 'available-locales.json');
  console.log(`Writing to "${jsonPath}"...`);
  await fs.writeFile(jsonPath, `${JSON.stringify(localeDirNames, null, 2)}\n`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
