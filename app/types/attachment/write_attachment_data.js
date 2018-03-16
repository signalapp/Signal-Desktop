const crypto = require('crypto');
const fse = require('fs-extra');
const isArrayBuffer = require('lodash/isArrayBuffer');
const isString = require('lodash/isString');
const path = require('path');


//      _writeAttachmentData :: AttachmentsPath ->
//                              ArrayBuffer ->
//                              IO (Promise Path)
exports.writeAttachmentData = (root) => {
  if (!isString(root)) {
    throw new TypeError('`root` must be a path');
  }

  return async (arrayBuffer) => {
    if (!isArrayBuffer(arrayBuffer)) {
      throw new TypeError('`arrayBuffer` must be an array buffer');
    }

    const buffer = Buffer.from(arrayBuffer);
    const relativePath = exports._getAttachmentPath();
    const absolutePath = path.join(root, relativePath);
    await fse.ensureFile(absolutePath);
    await fse.writeFile(absolutePath, buffer);
    return relativePath;
  };
};

//      _getAttachmentName :: Unit -> IO String
exports._getAttachmentName = () => {
  const buffer = crypto.randomBytes(32);
  return buffer.toString('hex');
};

//      _getAttachmentPath :: Unit -> IO Path
exports._getAttachmentPath = () => {
  const name = exports._getAttachmentName();
  const prefix = name.slice(0, 2);
  return path.join(prefix, name);
};
