// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { PassThrough } from 'node:stream';
import { join, relative, normalize } from 'path';
import fastGlob from 'fast-glob';
import fse from 'fs-extra';
import { map, isString } from 'lodash';
import normalizePath from 'normalize-path';
import { isPathInside } from '../ts/util/isPathInside';
import {
  generateKeys,
  decryptAttachmentV2ToSink,
  encryptAttachmentV2ToDisk,
} from '../ts/AttachmentCrypto';
import type { LocalAttachmentV2Type } from '../ts/types/Attachment';

const PATH = 'attachments.noindex';
const AVATAR_PATH = 'avatars.noindex';
const BADGES_PATH = 'badges.noindex';
const STICKER_PATH = 'stickers.noindex';
const TEMP_PATH = 'temp';
const UPDATE_CACHE_PATH = 'update-cache';
const DRAFT_PATH = 'drafts.noindex';

const CACHED_PATHS = new Map<string, string>();

const createPathGetter =
  (subpath: string) =>
  (userDataPath: string): string => {
    if (!isString(userDataPath)) {
      throw new TypeError("'userDataPath' must be a string");
    }

    const naivePath = join(userDataPath, subpath);

    const cached = CACHED_PATHS.get(naivePath);
    if (cached) {
      return cached;
    }

    let result = naivePath;
    if (fse.pathExistsSync(naivePath)) {
      result = fse.realpathSync(naivePath);
    }

    CACHED_PATHS.set(naivePath, result);

    return result;
  };

export const getAvatarsPath = createPathGetter(AVATAR_PATH);
export const getBadgesPath = createPathGetter(BADGES_PATH);
export const getDraftPath = createPathGetter(DRAFT_PATH);
export const getPath = createPathGetter(PATH);
export const getStickersPath = createPathGetter(STICKER_PATH);
export const getTempPath = createPathGetter(TEMP_PATH);
export const getUpdateCachePath = createPathGetter(UPDATE_CACHE_PATH);

export const createDeleter = (
  root: string
): ((relativePath: string) => Promise<void>) => {
  if (!isString(root)) {
    throw new TypeError("'root' must be a path");
  }

  return async (relativePath: string): Promise<void> => {
    if (!isString(relativePath)) {
      throw new TypeError("'relativePath' must be a string");
    }

    const absolutePath = join(root, relativePath);
    const normalized = normalize(absolutePath);
    if (!isPathInside(normalized, root)) {
      throw new Error('Invalid relative path');
    }
    await fse.remove(absolutePath);
  };
};

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

export const readAndDecryptDataFromDisk = async ({
  absolutePath,
  keysBase64,
  size,
}: {
  absolutePath: string;
  keysBase64: string;
  size: number;
}): Promise<Uint8Array> => {
  const sink = new PassThrough();

  const chunks = new Array<Buffer>();

  sink.on('data', chunk => chunks.push(chunk));
  sink.resume();

  await decryptAttachmentV2ToSink(
    {
      ciphertextPath: absolutePath,
      idForLogging: 'attachments/readAndDecryptDataFromDisk',
      keysBase64,
      size,
      type: 'local',
    },
    sink
  );

  return Buffer.concat(chunks);
};

export const writeNewAttachmentData = async ({
  data,
  getAbsoluteAttachmentPath,
}: {
  data: Uint8Array;
  getAbsoluteAttachmentPath: (relativePath: string) => string;
}): Promise<LocalAttachmentV2Type> => {
  const keys = generateKeys();

  const { plaintextHash, path } = await encryptAttachmentV2ToDisk({
    plaintext: { data },
    getAbsoluteAttachmentPath,
    keys,
  });

  return {
    version: 2,
    plaintextHash,
    size: data.byteLength,
    path,
    localKey: Buffer.from(keys).toString('base64'),
  };
};
