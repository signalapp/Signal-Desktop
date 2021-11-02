// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join, relative } from 'path';

import fastGlob from 'fast-glob';
import glob from 'glob';
import pify from 'pify';
import fse from 'fs-extra';
import { map } from 'lodash';
import normalizePath from 'normalize-path';

import {
  getPath,
  getStickersPath,
  getBadgesPath,
  getDraftPath,
  getTempPath,
  createDeleter,
} from '../ts/util/attachments';

export * from '../ts/util/attachments';

export const getAllAttachments = async (
  userDataPath: string
): Promise<ReadonlyArray<string>> => {
  const dir = getPath(userDataPath);
  const pattern = normalizePath(join(dir, '**', '*'));

  const files = await fastGlob(pattern, { onlyFiles: true });
  return map(files, file => relative(dir, file));
};

const getAllBadgeImageFiles = async (
  userDataPath: string
): Promise<ReadonlyArray<string>> => {
  const dir = getBadgesPath(userDataPath);
  const pattern = normalizePath(join(dir, '**', '*'));

  const files = await fastGlob(pattern, { onlyFiles: true });
  return map(files, file => relative(dir, file));
};

export const getAllStickers = async (
  userDataPath: string
): Promise<ReadonlyArray<string>> => {
  const dir = getStickersPath(userDataPath);
  const pattern = normalizePath(join(dir, '**', '*'));

  const files = await fastGlob(pattern, { onlyFiles: true });
  return map(files, file => relative(dir, file));
};

export const getAllDraftAttachments = async (
  userDataPath: string
): Promise<ReadonlyArray<string>> => {
  const dir = getDraftPath(userDataPath);
  const pattern = normalizePath(join(dir, '**', '*'));

  const files = await fastGlob(pattern, { onlyFiles: true });
  return map(files, file => relative(dir, file));
};

export const getBuiltInImages = async (): Promise<ReadonlyArray<string>> => {
  const dir = join(__dirname, '../images');
  const pattern = join(dir, '**', '*.svg');

  // Note: we cannot use fast-glob here because, inside of .asar files, readdir will not
  //   honor the withFileTypes flag: https://github.com/electron/electron/issues/19074
  const files = await pify(glob)(pattern, { nodir: true });
  return map(files, file => relative(dir, file));
};

export const clearTempPath = (userDataPath: string): Promise<void> => {
  const tempPath = getTempPath(userDataPath);
  return fse.emptyDir(tempPath);
};

export const deleteAll = async ({
  userDataPath,
  attachments,
}: {
  userDataPath: string;
  attachments: ReadonlyArray<string>;
}): Promise<void> => {
  const deleteFromDisk = createDeleter(getPath(userDataPath));

  for (let index = 0, max = attachments.length; index < max; index += 1) {
    const file = attachments[index];
    // eslint-disable-next-line no-await-in-loop
    await deleteFromDisk(file);
  }

  console.log(`deleteAll: deleted ${attachments.length} files`);
};

export const deleteAllStickers = async ({
  userDataPath,
  stickers,
}: {
  userDataPath: string;
  stickers: ReadonlyArray<string>;
}): Promise<void> => {
  const deleteFromDisk = createDeleter(getStickersPath(userDataPath));

  for (let index = 0, max = stickers.length; index < max; index += 1) {
    const file = stickers[index];
    // eslint-disable-next-line no-await-in-loop
    await deleteFromDisk(file);
  }

  console.log(`deleteAllStickers: deleted ${stickers.length} files`);
};

export const deleteAllBadges = async ({
  userDataPath,
  pathsToKeep,
}: {
  userDataPath: string;
  pathsToKeep: Set<string>;
}): Promise<void> => {
  const deleteFromDisk = createDeleter(getBadgesPath(userDataPath));

  let filesDeleted = 0;
  for (const file of await getAllBadgeImageFiles(userDataPath)) {
    if (!pathsToKeep.has(file)) {
      // eslint-disable-next-line no-await-in-loop
      await deleteFromDisk(file);
      filesDeleted += 1;
    }
  }

  console.log(`deleteAllBadges: deleted ${filesDeleted} files`);
};

export const deleteAllDraftAttachments = async ({
  userDataPath,
  attachments,
}: {
  userDataPath: string;
  attachments: ReadonlyArray<string>;
}): Promise<void> => {
  const deleteFromDisk = createDeleter(getDraftPath(userDataPath));

  for (let index = 0, max = attachments.length; index < max; index += 1) {
    const file = attachments[index];
    // eslint-disable-next-line no-await-in-loop
    await deleteFromDisk(file);
  }

  console.log(`deleteAllDraftAttachments: deleted ${attachments.length} files`);
};
