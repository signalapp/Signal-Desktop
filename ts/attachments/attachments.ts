import crypto from 'crypto';
import path from 'path';

import pify from 'pify';
import { default as glob } from 'glob';
import fse from 'fs-extra';
import toArrayBuffer from 'to-arraybuffer';
import { isArrayBuffer, isString, map } from 'lodash';
import {
  decryptAttachmentBuffer,
  encryptAttachmentBuffer,
} from '../../ts/types/Attachment';

const PATH = 'attachments.noindex';

export const getAllAttachments = async (userDataPath: string) => {
  const dir = exports.getPath(userDataPath);
  const pattern = path.join(dir, '**', '*');

  const files = await pify(glob)(pattern, { nodir: true });
  return map(files, file => path.relative(dir, file));
};

//      getPath :: AbsolutePath -> AbsolutePath
export const getPath = (userDataPath: string) => {
  if (!isString(userDataPath)) {
    throw new TypeError("'userDataPath' must be a string");
  }
  return path.join(userDataPath, PATH);
};

//      ensureDirectory :: AbsolutePath -> IO Unit
export const ensureDirectory = async (userDataPath: string) => {
  if (!isString(userDataPath)) {
    throw new TypeError("'userDataPath' must be a string");
  }
  await fse.ensureDir(exports.getPath(userDataPath));
};

//      createReader :: AttachmentsPath ->
//                      RelativePath ->
//                      IO (Promise ArrayBuffer)
export const createReader = (root: string) => {
  if (!isString(root)) {
    throw new TypeError("'root' must be a path");
  }

  return async (relativePath: string) => {
    if (!isString(relativePath)) {
      throw new TypeError("'relativePath' must be a string");
    }
    const absolutePath = path.join(root, relativePath);
    const normalized = path.normalize(absolutePath);
    if (!normalized.startsWith(root)) {
      throw new Error('Invalid relative path');
    }
    const buffer = await fse.readFile(normalized);

    const decryptedData = await decryptAttachmentBuffer(toArrayBuffer(buffer));

    return decryptedData.buffer;
  };
};

//      createWriterForNew :: AttachmentsPath ->
//                            ArrayBuffer ->
//                            IO (Promise RelativePath)
export const createWriterForNew = (root: string) => {
  if (!isString(root)) {
    throw new TypeError("'root' must be a path");
  }

  return async (arrayBuffer: ArrayBuffer) => {
    if (!isArrayBuffer(arrayBuffer)) {
      throw new TypeError("'arrayBuffer' must be an array buffer");
    }

    const name = exports.createName();
    const relativePath = exports.getRelativePath(name);
    return exports.createWriterForExisting(root)({
      data: arrayBuffer,
      path: relativePath,
    });
  };
};

//      createWriter :: AttachmentsPath ->
//                      { data: ArrayBuffer, path: RelativePath } ->
//                      IO (Promise RelativePath)
export const createWriterForExisting = (root: any) => {
  if (!isString(root)) {
    throw new TypeError("'root' must be a path");
  }

  return async ({
    data: arrayBuffer,
    path: relativePath,
  }: { data?: ArrayBuffer; path?: string } = {}) => {
    if (!isString(relativePath)) {
      throw new TypeError("'relativePath' must be a path");
    }

    if (!isArrayBuffer(arrayBuffer)) {
      throw new TypeError("'arrayBuffer' must be an array buffer");
    }

    const absolutePath = path.join(root, relativePath);
    const normalized = path.normalize(absolutePath);
    if (!normalized.startsWith(root)) {
      throw new Error('Invalid relative path');
    }

    await fse.ensureFile(normalized);
    const { encryptedBufferWithHeader } = await encryptAttachmentBuffer(
      arrayBuffer
    );
    const buffer = Buffer.from(encryptedBufferWithHeader.buffer);

    await fse.writeFile(normalized, buffer);

    return relativePath;
  };
};

//      createDeleter :: AttachmentsPath ->
//                       RelativePath ->
//                       IO Unit
export const createDeleter = (root: any) => {
  if (!isString(root)) {
    throw new TypeError("'root' must be a path");
  }

  return async (relativePath: any) => {
    if (!isString(relativePath)) {
      throw new TypeError("'relativePath' must be a string");
    }

    const absolutePath = path.join(root, relativePath);
    const normalized = path.normalize(absolutePath);
    if (!normalized.startsWith(root)) {
      throw new Error('Invalid relative path');
    }
    await fse.remove(absolutePath);
  };
};

export const deleteAll = async ({ userDataPath, attachments }: any) => {
  const deleteFromDisk = exports.createDeleter(exports.getPath(userDataPath));

  // tslint:disable-next-line: one-variable-per-declaration
  for (let index = 0, max = attachments.length; index < max; index += 1) {
    const file = attachments[index];
    // eslint-disable-next-line no-await-in-loop
    await deleteFromDisk(file);
  }

  window?.log?.info(`deleteAll: deleted ${attachments.length} files`);
};

//      createName :: Unit -> IO String
export const createName = () => {
  const buffer = crypto.randomBytes(32);
  return buffer.toString('hex');
};

//      getRelativePath :: String -> Path
export const getRelativePath = (name: any) => {
  if (!isString(name)) {
    throw new TypeError("'name' must be a string");
  }

  const prefix = name.slice(0, 2);
  return path.join(prefix, name);
};

//      createAbsolutePathGetter :: RootPath -> RelativePath -> AbsolutePath
export const createAbsolutePathGetter = (rootPath: string) => (
  relativePath: string
) => {
  const absolutePath = path.join(rootPath, relativePath);
  const normalized = path.normalize(absolutePath);
  if (!normalized.startsWith(rootPath)) {
    throw new Error('Invalid relative path');
  }
  return normalized;
};
