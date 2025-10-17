// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { readFile, writeFile, readdir, readlink } from 'node:fs/promises';
import { join, basename } from 'node:path';
import pMap from 'p-map';

import { drop } from '../util/drop.std.js';

async function main(): Promise<void> {
  const source = process.argv[2];
  if (!source) {
    throw new Error('Missing required source directory argument');
  }

  const dirEntries = await readdir(join(source, 'components'), {
    withFileTypes: true,
    recursive: true,
  });

  const enMessages = JSON.parse(
    await readFile(
      join(__dirname, '..', '..', '_locales', 'en', 'messages.json'),
      'utf8'
    )
  );

  const icuToStory: Record<string, Array<[string, string]>> = Object.create(
    null
  );

  await pMap(
    dirEntries,
    async entry => {
      if (!entry.isSymbolicLink()) {
        return;
      }

      const fullPath = join(entry.parentPath, entry.name);
      const image = basename(await readlink(fullPath));

      const storyId = basename(entry.parentPath);
      const linkFile = entry.name;

      const icuId = `icu:${basename(linkFile, '.jpg')}`;

      let list = icuToStory[icuId];
      if (list == null) {
        list = [];
        icuToStory[icuId] = list;
      }
      list.push([storyId, image]);
    },
    { concurrency: 20 }
  );

  const index = Object.entries(icuToStory).map(([key, icuIds]) => {
    return [key, enMessages[key]?.messageformat, icuIds];
  });
  const html = await readFile(
    join(__dirname, '..', '..', '.storybook', 'icu-lookup.html'),
    'utf8'
  );
  await writeFile(
    join(source, 'index.html'),
    html.replace('%INDEX%', JSON.stringify(index))
  );
}

drop(main());
