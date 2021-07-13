// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { randomBytes } from 'crypto';
import { basename, extname, join, normalize, relative } from 'path';
import { app, dialog, shell, remote } from 'electron';

import fastGlob from 'fast-glob';
import glob from 'glob';
import pify from 'pify';
import fse from 'fs-extra';
import { map, isArrayBuffer, isString } from 'lodash';
import normalizePath from 'normalize-path';
import sanitizeFilename from 'sanitize-filename';
import getGuid from 'uuid/v4';

import { typedArrayToArrayBuffer } from '../ts/Crypto';
import { isPathInside } from '../ts/util/isPathInside';
import { isWindows } from '../ts/OS';
import { writeWindowsZoneIdentifier } from '../ts/util/windowsZoneIdentifier';

type FSAttrType = {
  set: (path: string, attribute: string, value: string) => Promise<void>;
};

let xattr: FSAttrType | undefined;

try {
  // eslint-disable-next-line max-len
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies, import/no-unresolved
  xattr = require('fs-xattr');
} catch (e) {
  console.log('x-attr dependency did not load successfully');
}

const PATH = 'attachments.noindex';
const STICKER_PATH = 'stickers.noindex';
const TEMP_PATH = 'temp';
const DRAFT_PATH = 'drafts.noindex';

const getApp = () => app || remote.app;

export const getAllAttachments = async (
  userDataPath: string
): Promise<ReadonlyArray<string>> => {
  const dir = getPath(userDataPath);
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

export const getPath = (userDataPath: string): string => {
  if (!isString(userDataPath)) {
    throw new TypeError("'userDataPath' must be a string");
  }
  return join(userDataPath, PATH);
};

export const getStickersPath = (userDataPath: string): string => {
  if (!isString(userDataPath)) {
    throw new TypeError("'userDataPath' must be a string");
  }
  return join(userDataPath, STICKER_PATH);
};

export const getTempPath = (userDataPath: string): string => {
  if (!isString(userDataPath)) {
    throw new TypeError("'userDataPath' must be a string");
  }
  return join(userDataPath, TEMP_PATH);
};

export const getDraftPath = (userDataPath: string): string => {
  if (!isString(userDataPath)) {
    throw new TypeError("'userDataPath' must be a string");
  }
  return join(userDataPath, DRAFT_PATH);
};

export const clearTempPath = (userDataPath: string): Promise<void> => {
  const tempPath = getTempPath(userDataPath);
  return fse.emptyDir(tempPath);
};

export const createReader = (
  root: string
): ((relativePath: string) => Promise<ArrayBuffer>) => {
  if (!isString(root)) {
    throw new TypeError("'root' must be a path");
  }

  return async (relativePath: string): Promise<ArrayBuffer> => {
    if (!isString(relativePath)) {
      throw new TypeError("'relativePath' must be a string");
    }

    const absolutePath = join(root, relativePath);
    const normalized = normalize(absolutePath);
    if (!isPathInside(normalized, root)) {
      throw new Error('Invalid relative path');
    }
    const buffer = await fse.readFile(normalized);
    return typedArrayToArrayBuffer(buffer);
  };
};

export const createDoesExist = (
  root: string
): ((relativePath: string) => Promise<boolean>) => {
  if (!isString(root)) {
    throw new TypeError("'root' must be a path");
  }

  return async (relativePath: string): Promise<boolean> => {
    if (!isString(relativePath)) {
      throw new TypeError("'relativePath' must be a string");
    }

    const absolutePath = join(root, relativePath);
    const normalized = normalize(absolutePath);
    if (!isPathInside(normalized, root)) {
      throw new Error('Invalid relative path');
    }
    try {
      await fse.access(normalized, fse.constants.F_OK);
      return true;
    } catch (error) {
      return false;
    }
  };
};

export const copyIntoAttachmentsDirectory = (
  root: string
): ((sourcePath: string) => Promise<string>) => {
  if (!isString(root)) {
    throw new TypeError("'root' must be a path");
  }

  const userDataPath = getApp().getPath('userData');

  return async (sourcePath: string): Promise<string> => {
    if (!isString(sourcePath)) {
      throw new TypeError('sourcePath must be a string');
    }

    if (!isPathInside(sourcePath, userDataPath)) {
      throw new Error(
        "'sourcePath' must be relative to the user config directory"
      );
    }

    const name = createName();
    const relativePath = getRelativePath(name);
    const absolutePath = join(root, relativePath);
    const normalized = normalize(absolutePath);
    if (!isPathInside(normalized, root)) {
      throw new Error('Invalid relative path');
    }

    await fse.ensureFile(normalized);
    await fse.copy(sourcePath, normalized);
    return relativePath;
  };
};

export const writeToDownloads = async ({
  data,
  name,
}: {
  data: ArrayBuffer;
  name: string;
}): Promise<{ fullPath: string; name: string }> => {
  const appToUse = getApp();
  const downloadsPath =
    appToUse.getPath('downloads') || appToUse.getPath('home');
  const sanitized = sanitizeFilename(name);

  const extension = extname(sanitized);
  const fileBasename = basename(sanitized, extension);
  const getCandidateName = (count: number) =>
    `${fileBasename} (${count})${extension}`;

  const existingFiles = await fse.readdir(downloadsPath);
  let candidateName = sanitized;
  let count = 0;
  while (existingFiles.includes(candidateName)) {
    count += 1;
    candidateName = getCandidateName(count);
  }

  const target = join(downloadsPath, candidateName);
  const normalized = normalize(target);
  if (!isPathInside(normalized, downloadsPath)) {
    throw new Error('Invalid filename!');
  }

  await writeWithAttributes(normalized, data);

  return {
    fullPath: normalized,
    name: candidateName,
  };
};

async function writeWithAttributes(
  target: string,
  data: ArrayBuffer
): Promise<void> {
  await fse.writeFile(target, Buffer.from(data));

  if (process.platform === 'darwin' && xattr) {
    // kLSQuarantineTypeInstantMessageAttachment
    const type = '0003';

    // Hexadecimal seconds since epoch
    const timestamp = Math.trunc(Date.now() / 1000).toString(16);

    const appName = 'Signal';
    const guid = getGuid();

    // https://ilostmynotes.blogspot.com/2012/06/gatekeeper-xprotect-and-quarantine.html
    const attrValue = `${type};${timestamp};${appName};${guid}`;

    await xattr.set(target, 'com.apple.quarantine', attrValue);
  } else if (isWindows()) {
    // This operation may fail (see the function's comments), which is not a show-stopper.
    try {
      await writeWindowsZoneIdentifier(target);
    } catch (err) {
      console.warn('Failed to write Windows Zone.Identifier file; continuing');
    }
  }
}

export const openFileInDownloads = async (name: string): Promise<void> => {
  const shellToUse = shell || remote.shell;
  const appToUse = getApp();

  const downloadsPath =
    appToUse.getPath('downloads') || appToUse.getPath('home');
  const target = join(downloadsPath, name);

  const normalized = normalize(target);
  if (!isPathInside(normalized, downloadsPath)) {
    throw new Error('Invalid filename!');
  }

  shellToUse.showItemInFolder(normalized);
};

export const saveAttachmentToDisk = async ({
  data,
  name,
}: {
  data: ArrayBuffer;
  name: string;
}): Promise<null | { fullPath: string; name: string }> => {
  const dialogToUse = dialog || remote.dialog;
  const browserWindow = remote.getCurrentWindow();

  const { canceled, filePath } = await dialogToUse.showSaveDialog(
    browserWindow,
    {
      defaultPath: name,
    }
  );

  if (canceled || !filePath) {
    return null;
  }

  await writeWithAttributes(filePath, data);

  const fileBasename = basename(filePath);

  return {
    fullPath: filePath,
    name: fileBasename,
  };
};

export const openFileInFolder = async (target: string): Promise<void> => {
  const shellToUse = shell || remote.shell;

  shellToUse.showItemInFolder(target);
};

export const createWriterForNew = (
  root: string
): ((arrayBuffer: ArrayBuffer) => Promise<string>) => {
  if (!isString(root)) {
    throw new TypeError("'root' must be a path");
  }

  return async (arrayBuffer: ArrayBuffer) => {
    if (!isArrayBuffer(arrayBuffer)) {
      throw new TypeError("'arrayBuffer' must be an array buffer");
    }

    const name = createName();
    const relativePath = getRelativePath(name);
    return createWriterForExisting(root)({
      data: arrayBuffer,
      path: relativePath,
    });
  };
};

export const createWriterForExisting = (
  root: string
): ((options: { data: ArrayBuffer; path: string }) => Promise<string>) => {
  if (!isString(root)) {
    throw new TypeError("'root' must be a path");
  }

  return async ({
    data: arrayBuffer,
    path: relativePath,
  }: {
    data: ArrayBuffer;
    path: string;
  }): Promise<string> => {
    if (!isString(relativePath)) {
      throw new TypeError("'relativePath' must be a path");
    }

    if (!isArrayBuffer(arrayBuffer)) {
      throw new TypeError("'arrayBuffer' must be an array buffer");
    }

    const buffer = Buffer.from(arrayBuffer);
    const absolutePath = join(root, relativePath);
    const normalized = normalize(absolutePath);
    if (!isPathInside(normalized, root)) {
      throw new Error('Invalid relative path');
    }

    await fse.ensureFile(normalized);
    await fse.writeFile(normalized, buffer);
    return relativePath;
  };
};

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

export const createName = (): string => {
  const buffer = randomBytes(32);
  return buffer.toString('hex');
};

export const getRelativePath = (name: string): string => {
  if (!isString(name)) {
    throw new TypeError("'name' must be a string");
  }

  const prefix = name.slice(0, 2);
  return join(prefix, name);
};

export const createAbsolutePathGetter = (rootPath: string) => (
  relativePath: string
): string => {
  const absolutePath = join(rootPath, relativePath);
  const normalized = normalize(absolutePath);
  if (!isPathInside(normalized, rootPath)) {
    throw new Error('Invalid relative path');
  }
  return normalized;
};
