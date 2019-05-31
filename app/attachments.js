const crypto = require('crypto');
const path = require('path');

const pify = require('pify');
const glob = require('glob');
const fse = require('fs-extra');
const toArrayBuffer = require('to-arraybuffer');
const { map, isArrayBuffer, isString } = require('lodash');

const PATH = 'attachments.noindex';
const STICKER_PATH = 'stickers.noindex';
const TEMP_PATH = 'temp';

exports.getAllAttachments = async userDataPath => {
  const dir = exports.getPath(userDataPath);
  const pattern = path.join(dir, '**', '*');

  const files = await pify(glob)(pattern, { nodir: true });
  return map(files, file => path.relative(dir, file));
};

exports.getAllStickers = async userDataPath => {
  const dir = exports.getStickersPath(userDataPath);
  const pattern = path.join(dir, '**', '*');

  const files = await pify(glob)(pattern, { nodir: true });
  return map(files, file => path.relative(dir, file));
};

//      getPath :: AbsolutePath -> AbsolutePath
exports.getPath = userDataPath => {
  if (!isString(userDataPath)) {
    throw new TypeError("'userDataPath' must be a string");
  }
  return path.join(userDataPath, PATH);
};

//      getStickersPath :: AbsolutePath -> AbsolutePath
exports.getStickersPath = userDataPath => {
  if (!isString(userDataPath)) {
    throw new TypeError("'userDataPath' must be a string");
  }
  return path.join(userDataPath, STICKER_PATH);
};

//      getTempPath :: AbsolutePath -> AbsolutePath
exports.getTempPath = userDataPath => {
  if (!isString(userDataPath)) {
    throw new TypeError("'userDataPath' must be a string");
  }
  return path.join(userDataPath, TEMP_PATH);
};

//      clearTempPath :: AbsolutePath -> AbsolutePath
exports.clearTempPath = userDataPath => {
  const tempPath = exports.getTempPath(userDataPath);
  return fse.emptyDir(tempPath);
};

//      createReader :: AttachmentsPath ->
//                      RelativePath ->
//                      IO (Promise ArrayBuffer)
exports.createReader = root => {
  if (!isString(root)) {
    throw new TypeError("'root' must be a path");
  }

  return async relativePath => {
    if (!isString(relativePath)) {
      throw new TypeError("'relativePath' must be a string");
    }

    const absolutePath = path.join(root, relativePath);
    const normalized = path.normalize(absolutePath);
    if (!normalized.startsWith(root)) {
      throw new Error('Invalid relative path');
    }
    const buffer = await fse.readFile(normalized);
    return toArrayBuffer(buffer);
  };
};

exports.copyIntoAttachmentsDirectory = root => {
  if (!isString(root)) {
    throw new TypeError("'root' must be a path");
  }

  return async sourcePath => {
    if (!isString(sourcePath)) {
      throw new TypeError('sourcePath must be a string');
    }

    const name = exports.createName();
    const relativePath = exports.getRelativePath(name);
    const absolutePath = path.join(root, relativePath);
    const normalized = path.normalize(absolutePath);
    if (!normalized.startsWith(root)) {
      throw new Error('Invalid relative path');
    }

    await fse.ensureFile(normalized);
    await fse.copy(sourcePath, normalized);
    return relativePath;
  };
};

//      createWriterForNew :: AttachmentsPath ->
//                            ArrayBuffer ->
//                            IO (Promise RelativePath)
exports.createWriterForNew = root => {
  if (!isString(root)) {
    throw new TypeError("'root' must be a path");
  }

  return async arrayBuffer => {
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
exports.createWriterForExisting = root => {
  if (!isString(root)) {
    throw new TypeError("'root' must be a path");
  }

  return async ({ data: arrayBuffer, path: relativePath } = {}) => {
    if (!isString(relativePath)) {
      throw new TypeError("'relativePath' must be a path");
    }

    if (!isArrayBuffer(arrayBuffer)) {
      throw new TypeError("'arrayBuffer' must be an array buffer");
    }

    const buffer = Buffer.from(arrayBuffer);
    const absolutePath = path.join(root, relativePath);
    const normalized = path.normalize(absolutePath);
    if (!normalized.startsWith(root)) {
      throw new Error('Invalid relative path');
    }

    await fse.ensureFile(normalized);
    await fse.writeFile(normalized, buffer);
    return relativePath;
  };
};

//      createDeleter :: AttachmentsPath ->
//                       RelativePath ->
//                       IO Unit
exports.createDeleter = root => {
  if (!isString(root)) {
    throw new TypeError("'root' must be a path");
  }

  return async relativePath => {
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

exports.deleteAll = async ({ userDataPath, attachments }) => {
  const deleteFromDisk = exports.createDeleter(exports.getPath(userDataPath));

  for (let index = 0, max = attachments.length; index < max; index += 1) {
    const file = attachments[index];
    // eslint-disable-next-line no-await-in-loop
    await deleteFromDisk(file);
  }

  console.log(`deleteAll: deleted ${attachments.length} files`);
};

exports.deleteAllStickers = async ({ userDataPath, stickers }) => {
  const deleteFromDisk = exports.createDeleter(
    exports.getStickersPath(userDataPath)
  );

  for (let index = 0, max = stickers.length; index < max; index += 1) {
    const file = stickers[index];
    // eslint-disable-next-line no-await-in-loop
    await deleteFromDisk(file);
  }

  console.log(`deleteAllStickers: deleted ${stickers.length} files`);
};

//      createName :: Unit -> IO String
exports.createName = () => {
  const buffer = crypto.randomBytes(32);
  return buffer.toString('hex');
};

//      getRelativePath :: String -> Path
exports.getRelativePath = name => {
  if (!isString(name)) {
    throw new TypeError("'name' must be a string");
  }

  const prefix = name.slice(0, 2);
  return path.join(prefix, name);
};

//      createAbsolutePathGetter :: RootPath -> RelativePath -> AbsolutePath
exports.createAbsolutePathGetter = rootPath => relativePath => {
  const absolutePath = path.join(rootPath, relativePath);
  const normalized = path.normalize(absolutePath);
  if (!normalized.startsWith(rootPath)) {
    throw new Error('Invalid relative path');
  }
  return normalized;
};
