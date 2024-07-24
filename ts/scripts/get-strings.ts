// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { rm, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import fastGlob from 'fast-glob';
import unzipper from 'unzipper';
import prettier from 'prettier';

import { authenticate, API_BASE, PROJECT_ID } from '../util/smartling';

const { SMARTLING_USER, SMARTLING_SECRET } = process.env;

const RENAMES = new Map([
  // Smartling uses "zh-YU" for Cantonese (or Yue Chinese).
  // This is wrong.
  // The language tag for Yue Chinese is "yue"
  // "zh-YU" actually implies "Chinese as spoken in Yugoslavia (canonicalized to Serbia)"
  ['zh-YU', 'yue'],

  // For most of the Chinese-speaking world, where we don't have a region specific
  // locale available (e.g. zh-HK), zh-TW is a suitable choice for "Traditional Chinese".
  //
  // However, Intl.LocaleMatcher won't match "zh-Hant-XX" to "zh-TW",
  // we need to rename it to "zh-Hant" explicitly to make it work.
  ['zh-TW', 'zh-Hant'],

  // "YR" is not a valid region subtag. Smartling made it up.
  ['sr-YR', 'sr'],
]);

async function main() {
  if (!SMARTLING_USER) {
    console.error('Need to set SMARTLING_USER environment variable!');
    process.exit(1);
  }
  if (!SMARTLING_SECRET) {
    console.error('Need to set SMARTLING_SECRET environment variable!');
    process.exit(1);
  }

  console.log('Authenticating with Smartling');
  const headers = await authenticate({
    userIdentifier: SMARTLING_USER,
    userSecret: SMARTLING_SECRET,
  });

  const zipURL = new URL(
    `./files-api/v2/projects/${PROJECT_ID}/locales/all/file/zip`,
    API_BASE
  );
  zipURL.searchParams.set('fileUri', '_locales/en/messages.json');
  zipURL.searchParams.set('retrievalType', 'published');
  zipURL.searchParams.set('includeOriginalStrings', 'true');

  const fileRes = await fetch(zipURL, {
    headers,
  });

  if (!fileRes.ok) {
    throw new Error('Failed to fetch the file');
  }
  if (!fileRes.body) {
    throw new Error('Missing body');
  }

  console.log('Cleaning _locales directory...');
  const dirEntries = await fastGlob(['_locales/*', '!_locales/en'], {
    onlyDirectories: true,
    absolute: true,
  });

  await Promise.all(
    dirEntries.map(dirEntry => rm(dirEntry, { recursive: true }))
  );

  console.log('Getting latest strings');

  const prettierConfig = await prettier.resolveConfig('_locales');

  const zip = Readable.from(
    fileRes.body as unknown as AsyncIterable<Uint8Array>
  ).pipe(unzipper.Parse({ forceStream: true }));
  for await (const entry of zip) {
    if (entry.type !== 'File') {
      entry.autodrain();
      continue;
    }

    let [locale] = entry.path.split(/[\\/]/, 1);
    locale = RENAMES.get(locale) ?? locale;

    const targetDir = path.join('_locales', locale);
    try {
      await mkdir(targetDir);
    } catch (error) {
      console.error(error);
    }

    const targetFile = path.join(targetDir, 'messages.json');
    console.log('Writing', locale);
    const json = JSON.parse((await entry.buffer()).toString());
    for (const value of Object.values(json)) {
      const typedValue = value as { description?: string };
      delete typedValue.description;
    }
    delete json.smartling;
    const output = await prettier.format(JSON.stringify(json, null, 2), {
      ...prettierConfig,
      filepath: targetFile,
    });
    await writeFile(targetFile, output);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
