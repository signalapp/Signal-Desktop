// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import pMap from 'p-map';
import z from 'zod';

import { drop } from '../util/drop';

const jsonSchema = z.string().array();

async function main(): Promise<void> {
  const source = process.argv[2];
  if (!source) {
    throw new Error('Missing required source directory argument');
  }

  const ids = await readdir(join(source, 'data'), { withFileTypes: true });

  const enMessages = JSON.parse(
    await readFile(
      join(__dirname, '..', '..', '_locales', 'en', 'messages.json'),
      'utf8'
    )
  );

  const icuToStory: Record<string, Array<string>> = Object.create(null);

  await pMap(
    ids,
    async entity => {
      if (!entity.isDirectory()) {
        return;
      }

      const storyId = entity.name;
      const dir = join(source, 'data', storyId);

      const strings = jsonSchema.parse(
        JSON.parse(await readFile(join(dir, 'strings.json'), 'utf8'))
      );

      for (const icuId of strings) {
        let list = icuToStory[icuId];
        if (list == null) {
          list = [];
          icuToStory[icuId] = list;
        }
        list.push(storyId);
      }
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
