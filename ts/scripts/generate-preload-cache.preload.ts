// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Module } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { ipcRenderer } from 'electron';

ipcRenderer.on('compile', async () => {
  try {
    const sourceFile = join(__dirname, '..', '..', 'preload.bundle.js');
    const outFile = sourceFile.replace(/\.js$/, '');

    const source = await readFile(sourceFile, 'utf8');
    const script = new Script(Module.wrap(source), {
      filename: 'preload.bundle.js',
      produceCachedData: true,
    });
    if (!script.cachedDataProduced || !script.cachedData) {
      throw new Error('Cached data not produced');
    }

    await writeFile(`${outFile}.cache`, script.cachedData);
    await ipcRenderer.invoke('done');
  } catch (error) {
    await ipcRenderer.invoke('error', error);
  }
});
