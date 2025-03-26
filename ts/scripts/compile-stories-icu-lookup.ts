// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { readFile, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import pMap from 'p-map';
import fastGlob from 'fast-glob';

import { drop } from '../util/drop';

async function main(): Promise<void> {
  const source = process.argv[2];
  if (!source) {
    throw new Error('Missing required source directory argument');
  }

  const dirEntries = await fastGlob('*/*.jpg', {
    cwd: join(source, 'data'),
    onlyFiles: true,
  });

  const enMessages = JSON.parse(
    await readFile(
      join(__dirname, '..', '..', '_locales', 'en', 'messages.json'),
      'utf8'
    )
  );

  const icuToStory: Record<string, Array<string>> = Object.create(null);

  await pMap(
    dirEntries,
    async entry => {
      const [storyId, imageFile] = entry.split('/', 2);

      const icuId = `icu:${basename(imageFile, '.jpg')}`;

      let list = icuToStory[icuId];
      if (list == null) {
        list = [];
        icuToStory[icuId] = list;
      }
      list.push(storyId);
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
