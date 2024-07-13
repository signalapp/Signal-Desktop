// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { tmpdir } from 'os';
import { mkdtemp, rm, rename, stat } from 'fs/promises';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createHash } from 'crypto';
import path from 'path';
import type { ArtifactCreated } from 'electron-builder';

export async function artifactBuildCompleted({
  target,
  file,
  packager,
  updateInfo,
}: ArtifactCreated): Promise<void> {
  if (packager.platform.name !== 'mac') {
    return;
  }
  if (target?.name !== 'zip') {
    return;
  }
  if (!file.endsWith('.zip')) {
    return;
  }

  // ESM module
  const { optimize } = await import('@indutny/rezip-electron');

  const tmpFolder = await mkdtemp(path.join(tmpdir(), 'rezip'));
  const optimizedPath = path.join(tmpFolder, path.basename(file));

  try {
    console.log(`Optimizing ${file} => ${optimizedPath}`);

    await optimize({
      inputPath: file,
      outputPath: optimizedPath,
      blockMapPath: `${file}.blockmap`,
    });

    console.log(`Replacing ${file}`);
    await rename(optimizedPath, file);
  } finally {
    await rm(tmpFolder, { recursive: true });
  }

  console.log('Updating hash and size');
  const sha512 = createHash('sha512');
  await pipeline(createReadStream(file), sha512);
  // eslint-disable-next-line no-param-reassign
  updateInfo.sha512 = sha512.digest('base64');
  const { size } = await stat(file);
  // eslint-disable-next-line no-param-reassign
  updateInfo.size = size;
}
