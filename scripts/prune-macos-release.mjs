// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import fs, { readdir, rm } from 'node:fs/promises';
import path from 'node:path';

/** @import { AfterPackContext } from 'electron-builder' */

/**
 * @param {string} dir
 * @returns {Promise<Array<string> | null>}
 */
async function safeReaddir(dir) {
  try {
    return await readdir(dir);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * @param {AfterPackContext} context
 * @returns {Promise<void>}
 */
export async function afterPack({ appOutDir, packager, electronPlatformName }) {
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
    // oxlint-disable-next-line no-await-in-loop
    await rm(targetPath, { recursive: true, force: true });

    // oxlint-disable-next-line no-await-in-loop
    await fs.rename(sourcePath, targetPath);
  }

  console.log('Removing duplicate electron framework', versionsDir);
  await rm(versionsDir, { recursive: true, force: true });
}
