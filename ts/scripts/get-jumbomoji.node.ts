// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Buffer } from 'node:buffer';
import z from 'zod';
import prettier from 'prettier';

import type { OptionalResourceType } from '../types/OptionalResource.std.js';
import { OptionalResourcesDictSchema } from '../types/OptionalResource.std.js';
import { parseUnknown } from '../util/schemas.std.js';
import { utf16ToEmoji } from '../util/utf16ToEmoji.node.js';

const VERSION = 12;

const STATIC_URL = 'https://updates.signal.org/static/android/emoji';
const STATIC_PINNED_URL = 'https://updates2.signal.org/static/android/emoji';
const MANIFEST_URL = `${STATIC_URL}/${VERSION}/emoji_data.json`;

const ManifestSchema = z.object({
  jumbomoji: z.record(z.string(), z.string().transform(utf16ToEmoji).array()),
});

async function fetchJSON(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }

  return res.json();
}

async function main(): Promise<void> {
  const { jumbomoji } = parseUnknown(
    ManifestSchema,
    await fetchJSON(MANIFEST_URL)
  );

  const extraResources = new Map<string, OptionalResourceType>();

  await Promise.all(
    Array.from(Object.keys(jumbomoji)).map(async sheet => {
      const publicUrl = `${STATIC_URL}/${VERSION}/xhdpi/jumbo/${sheet}.proto`;

      const res = await fetch(publicUrl);
      if (!res.ok) {
        throw new Error(`Failed to fetch ${publicUrl}`);
      }

      const data = Buffer.from(await res.arrayBuffer());

      const digest = createHash('sha512').update(data).digest('base64');

      const pinnedUrl = `${STATIC_PINNED_URL}/${VERSION}/xhdpi/jumbo/${sheet}.proto`;

      extraResources.set(sheet, {
        url: pinnedUrl,
        size: data.length,
        digest,
      });
    })
  );

  const manifestPath = join(__dirname, '..', '..', 'build', 'jumbomoji.json');

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

  for (const [sheet, resource] of extraResources) {
    resources[`emoji-sheet-${sheet}.proto`] = resource;
  }

  const prettierConfig = await prettier.resolveConfig(
    join(__dirname, '..', '..', 'build')
  );

  {
    const output = await prettier.format(JSON.stringify(jumbomoji, null, 2), {
      ...prettierConfig,
      filepath: manifestPath,
    });
    await writeFile(manifestPath, output);
  }

  {
    const output = await prettier.format(JSON.stringify(resources, null, 2), {
      ...prettierConfig,
      filepath: resourcesPath,
    });
    await writeFile(resourcesPath, output);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
