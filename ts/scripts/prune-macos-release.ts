// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AfterPackContext } from 'electron-builder';
import fs, { readdir, rm } from 'node:fs/promises';
import path from 'path';

async function safeReaddir(dir: string): Promise<Array<string> | null> {
  try {
    return await readdir(dir);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function afterPack({
  appOutDir,
  packager,
  electronPlatformName,
}: AfterPackContext): Promise<void> {
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const { productFilename } = packager.appInfo;

  const frameworkDir = path.join(
    appOutDir,
    `${productFilename}.app`,
    'Contents',
    'Frameworks',
    'Electron Framework.framework'
  );

  const versionsDir = path.join(frameworkDir, 'Versions');
  const currentVersion = path.join(versionsDir, 'Current');

  let subFolders = await safeReaddir(currentVersion);
  if (subFolders == null) {
    console.error(`${currentVersion} not found`);
    subFolders = [];
  }
  for (const folder of subFolders) {
    const sourcePath = path.join(currentVersion, folder);
    const targetPath = path.join(frameworkDir, folder);

    console.log(
      'Replacing electron framework symlink with real folder',
      sourcePath
    );
    // eslint-disable-next-line no-await-in-loop
    await rm(targetPath, { recursive: true, force: true });

    // eslint-disable-next-line no-await-in-loop
    await fs.rename(sourcePath, targetPath);
  }

  console.log('Removing duplicate electron framework', versionsDir);
  await rm(versionsDir, { recursive: true, force: true });
}
