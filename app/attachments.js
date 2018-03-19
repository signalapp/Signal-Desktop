const crypto = require('crypto');
const fse = require('fs-extra');
const isArrayBuffer = require('lodash/isArrayBuffer');
const isString = require('lodash/isString');
const path = require('path');
const toArrayBuffer = require('to-arraybuffer');


const PATH = 'attachments';


//      getPath :: AbsolutePath -> AbsolutePath
exports.getPath = (userDataPath) => {
  if (!isString(userDataPath)) {
    throw new TypeError('`userDataPath` must be a string');
  }
  return path.join(userDataPath, PATH);
};

//      ensureDirectory :: AbsolutePath -> IO Unit
exports.ensureDirectory = async (userDataPath) => {
  if (!isString(userDataPath)) {
    throw new TypeError('`userDataPath` must be a string');
  }
  await fse.ensureDir(exports.getPath(userDataPath));
};

//      readData :: AttachmentsPath ->
//                  RelativePath ->
//                  IO (Promise ArrayBuffer)
exports.readData = (root) => {
  if (!isString(root)) {
    throw new TypeError('`root` must be a path');
  }

  return async (relativePath) => {
    if (!isString(relativePath)) {
      throw new TypeError('`relativePath` must be a string');
    }

    const absolutePath = path.join(root, relativePath);
    const buffer = await fse.readFile(absolutePath);
    return toArrayBuffer(buffer);
  };
};

//      writeData :: AttachmentsPath ->
//                   ArrayBuffer ->
//                   IO (Promise RelativePath)
exports.writeData = (root) => {
  if (!isString(root)) {
    throw new TypeError('`root` must be a path');
  }

  return async (arrayBuffer) => {
    if (!isArrayBuffer(arrayBuffer)) {
      throw new TypeError('`arrayBuffer` must be an array buffer');
    }

    const buffer = Buffer.from(arrayBuffer);
    const name = exports.createName();
    const relativePath = exports.getRelativePath(name);
    const absolutePath = path.join(root, relativePath);
    await fse.ensureFile(absolutePath);
    await fse.writeFile(absolutePath, buffer);
    return relativePath;
  };
};

//      deleteData :: AttachmentsPath -> IO Unit
exports.deleteData = (root) => {
  if (!isString(root)) {
    throw new TypeError('`root` must be a path');
  }

  return async (relativePath) => {
    if (!isString(relativePath)) {
      throw new TypeError('`relativePath` must be a string');
    }

    const absolutePath = path.join(root, relativePath);
    await fse.remove(absolutePath);
  };
};

//      createName :: Unit -> IO String
exports.createName = () => {
  const buffer = crypto.randomBytes(32);
  return buffer.toString('hex');
};

//      getRelativePath :: String -> IO Path
exports.getRelativePath = (name) => {
  if (!isString(name)) {
    throw new TypeError('`name` must be a string');
  }

  const prefix = name.slice(0, 2);
  return path.join(prefix, name);
};
