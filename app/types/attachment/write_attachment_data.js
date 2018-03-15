const crypto = require('crypto');
const FSE = require('fs-extra');
const isArrayBuffer = require('lodash/isArrayBuffer');
const isString = require('lodash/isString');
const Path = require('path');


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
    const path = Path.join(root, exports._getAttachmentPath());
    await FSE.ensureFile(path);
    await FSE.writeFile(path, buffer);
    return path;
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
  const prefix = name.slice(0, 3);
  return Path.join(prefix, name);
};
