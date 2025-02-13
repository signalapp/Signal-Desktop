// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { PassThrough } from 'node:stream';
import { stat } from 'node:fs/promises';
import { join, relative, normalize } from 'path';
import pMap from 'p-map';
import fastGlob from 'fast-glob';
import fse from 'fs-extra';
import { map, isString } from 'lodash';
import normalizePath from 'normalize-path';
import { isPathInside } from '../ts/util/isPathInside';
import { DAY } from '../ts/util/durations';
import { isOlderThan } from '../ts/util/timestamp';
import { isNotNil } from '../ts/util/isNotNil';
import {
  generateKeys,
  decryptAttachmentV2ToSink,
  encryptAttachmentV2ToDisk,
} from '../ts/AttachmentCrypto';
import type { LocalAttachmentV2Type } from '../ts/types/Attachment';
import * as Errors from '../ts/types/errors';

const PATH = 'attachments.noindex';
const AVATAR_PATH = 'avatars.noindex';
const BADGES_PATH = 'badges.noindex';
const STICKER_PATH = 'stickers.noindex';
const TEMP_PATH = 'temp';
const UPDATE_CACHE_PATH = 'update-cache';
const DRAFT_PATH = 'drafts.noindex';
const DOWNLOADS_PATH = 'downloads.noindex';

const CACHED_PATHS = new Map<string, string>();

const FS_CONCURRENCY = 100;

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
export const getDownloadsPath = createPathGetter(DOWNLOADS_PATH);
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

export function prepareGlobPattern(dir: string): string {
  const prefix = normalizePath(dir).replace(/([$^*+?()[\]])/g, '\\$1');
  // fast-glob uses `/` for all platforms
  return `${prefix}/**/*`;
}

async function getAllFiles(dir: string): Promise<ReadonlyArray<string>> {
  const pattern = prepareGlobPattern(dir);

  const files = await fastGlob(pattern, { onlyFiles: true });
  return map(files, file => relative(dir, file));
}

export const getAllAttachments = (
  userDataPath: string
): Promise<ReadonlyArray<string>> => {
  return getAllFiles(getPath(userDataPath));
};

export const getAllDownloads = (
  userDataPath: string
): Promise<ReadonlyArray<string>> => {
  return getAllFiles(getDownloadsPath(userDataPath));
};

const getAllBadgeImageFiles = (
  userDataPath: string
): Promise<ReadonlyArray<string>> => {
  return getAllFiles(getBadgesPath(userDataPath));
};

export const getAllStickers = (
  userDataPath: string
): Promise<ReadonlyArray<string>> => {
  return getAllFiles(getStickersPath(userDataPath));
};

export const getAllDraftAttachments = async (
  userDataPath: string
): Promise<ReadonlyArray<string>> => {
  return getAllFiles(getDraftPath(userDataPath));
};

export const clearTempPath = (userDataPath: string): Promise<void> => {
  const tempPath = getTempPath(userDataPath);
  return fse.emptyDir(tempPath);
};

export const deleteStaleDownloads = async (
  userDataPath: string
): Promise<void> => {
  const dir = getDownloadsPath(userDataPath);
  const files = await getAllDownloads(userDataPath);

  const result = await pMap(
    files,
    async file => {
      try {
        const { birthtimeMs } = await stat(join(dir, file));
        if (isOlderThan(birthtimeMs, DAY)) {
          return file;
        }
      } catch (error) {
        // No longer exists
        if (error.code === 'ENOENT') {
          return;
        }
        console.error(
          'deleteStaleDownloads: failed to get file stats',
          Errors.toLogFormat(error)
        );
      }
      return undefined;
    },
    { concurrency: FS_CONCURRENCY }
  );

  const stale = result.filter(isNotNil);
  if (stale.length === 0) {
    return;
  }
  console.log(`deleteStaleDownloads: found ${stale.length}`);
  await deleteAllDownloads({ userDataPath, downloads: stale });
};

export const deleteAll = async ({
  userDataPath,
  attachments,
}: {
  userDataPath: string;
  attachments: ReadonlyArray<string>;
}): Promise<void> => {
  const deleteFromDisk = createDeleter(getPath(userDataPath));

  await pMap(attachments, deleteFromDisk, { concurrency: FS_CONCURRENCY });

  console.log(`deleteAll: deleted ${attachments.length} files`);
};

export const deleteAllDownloads = async ({
  userDataPath,
  downloads,
}: {
  userDataPath: string;
  downloads: ReadonlyArray<string>;
}): Promise<void> => {
  const deleteFromDisk = createDeleter(getDownloadsPath(userDataPath));

  await pMap(downloads, deleteFromDisk, { concurrency: FS_CONCURRENCY });

  console.log(`deleteAllDownloads: deleted ${downloads.length} files`);
};

export const deleteAllStickers = async ({
  userDataPath,
  stickers,
}: {
  userDataPath: string;
  stickers: ReadonlyArray<string>;
}): Promise<void> => {
  const deleteFromDisk = createDeleter(getStickersPath(userDataPath));

  await pMap(stickers, deleteFromDisk, { concurrency: FS_CONCURRENCY });

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

  await pMap(attachments, deleteFromDisk, { concurrency: FS_CONCURRENCY });

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
    getAbsoluteAttachmentPath,
    needIncrementalMac: false,
    plaintext: { data },
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
