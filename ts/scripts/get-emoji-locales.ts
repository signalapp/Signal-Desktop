// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import z from 'zod';
import prettier from 'prettier';

import type { OptionalResourceType } from '../types/OptionalResource';
import { OptionalResourcesDictSchema } from '../types/OptionalResource';
import { parseUnknown } from '../util/schemas';

const MANIFEST_URL =
  'https://updates.signal.org/dynamic/android/emoji/search/manifest.json';

const ManifestSchema = z.object({
  version: z.number(),
  languages: z.string().array(),
  languageToSmartlingLocale: z.record(z.string(), z.string()),
});

async function fetchJSON(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }

  return res.json();
}

async function main(): Promise<void> {
  const manifest = parseUnknown(ManifestSchema, await fetchJSON(MANIFEST_URL));

  // eslint-disable-next-line dot-notation
  manifest.languageToSmartlingLocale['zh_TW'] = 'zh-Hant';
  // eslint-disable-next-line dot-notation
  manifest.languageToSmartlingLocale['sr'] = 'sr';

  const extraResources = new Map<string, OptionalResourceType>();

  await Promise.all(
    manifest.languages.map(async language => {
      const langUrl =
        'https://updates.signal.org/static/android/' +
        `emoji/search/${manifest.version}/${language}.json`;

      const res = await fetch(langUrl);
      if (!res.ok) {
        throw new Error(`Failed to fetch ${langUrl}`);
      }

      const data = Buffer.from(await res.arrayBuffer());

      const digest = createHash('sha512').update(data).digest('base64');

      let locale = manifest.languageToSmartlingLocale[language] ?? language;
      locale = locale.replace(/_/g, '-');

      const pinnedUrl =
        'https://updates2.signal.org/static/android/' +
        `emoji/search/${manifest.version}/${language}.json`;

      extraResources.set(locale, {
        url: pinnedUrl,
        size: data.length,
        digest,
      });
    })
  );

  const resourcesPath = join(
    __dirname,
    '..',
    '..',
    'build',
    'optional-resources.json'
  );
  const resources = parseUnknown(
    OptionalResourcesDictSchema,
    JSON.parse(await readFile(resourcesPath, 'utf8')) as unknown
  );

  for (const [locale, resource] of extraResources) {
    resources[`emoji-index-${locale}.json`] = resource;
  }

  const prettierConfig = await prettier.resolveConfig(
    join(__dirname, '..', '..', 'build')
  );

  const output = await prettier.format(JSON.stringify(resources, null, 2), {
    ...prettierConfig,
    filepath: resourcesPath,
  });
  await writeFile(resourcesPath, output);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
