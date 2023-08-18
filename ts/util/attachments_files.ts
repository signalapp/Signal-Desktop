import crypto from 'crypto';
import path from 'path';

import fse from 'fs-extra';
import { isArrayBuffer, isBuffer, isString } from 'lodash';
import {
  decryptAttachmentBufferRenderer,
  encryptAttachmentBufferRenderer,
} from './local_attachments_encrypter';

// to me, this file is only used in the renderer
// import { decryptAttachmentBuffer, encryptAttachmentBuffer } from './encrypt_attachment_buffer';

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
    if (!isBuffer(buffer)) {
      throw new TypeError("'bufferIn' must be a buffer");
    }

    const decryptedData = await decryptAttachmentBufferRenderer(buffer.buffer);

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

    const name = createName();
    const relativePath = getRelativePath(name);
    return createWriterForExisting(root)({
      data: arrayBuffer,
      path: relativePath,
    });
  };
};

//      createWriter :: AttachmentsPath ->
//                      { data: ArrayBuffer, path: RelativePath } ->
//                      IO (Promise RelativePath)
const createWriterForExisting = (root: string) => {
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
    if (!isArrayBuffer(arrayBuffer)) {
      throw new TypeError("'bufferIn' must be an array buffer");
    }

    const { encryptedBufferWithHeader } = (await encryptAttachmentBufferRenderer(
      arrayBuffer
    )) as any;
    const buffer = Buffer.from(encryptedBufferWithHeader.buffer);

    await fse.writeFile(normalized, buffer);

    return relativePath;
  };
};

//      createName :: Unit -> IO String
const createName = () => {
  const buffer = crypto.randomBytes(32);
  return buffer.toString('hex');
};

//      getRelativePath :: String -> Path
const getRelativePath = (name: string) => {
  if (!isString(name)) {
    throw new TypeError("'name' must be a string");
  }

  const prefix = name.slice(0, 2);
  return path.join(prefix, name);
};

//      createAbsolutePathGetter :: RootPath -> RelativePath -> AbsolutePath
export const createAbsolutePathGetter = (rootPath: string) => (relativePath: string) => {
  const absolutePath = path.join(rootPath, relativePath);
  const normalized = path.normalize(absolutePath);
  if (!normalized.startsWith(rootPath)) {
    throw new Error('Invalid relative path');
  }
  return normalized;
};
