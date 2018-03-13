const crypto = require('crypto');
const FSE = require('fs-extra');
const isArrayBuffer = require('lodash/isArrayBuffer');
const isBuffer = require('lodash/isBuffer');
const isString = require('lodash/isString');
const Path = require('path');


exports.writeAttachmentData = (root) => {
  if (!isString(root)) {
    throw new TypeError('`root` must be a path');
  }

  return async (arrayBuffer) => {
    if (!isArrayBuffer(arrayBuffer)) {
      throw new TypeError('`arrayBuffer` must be an array buffer');
    }

    const buffer = new Buffer(arrayBuffer);
    const path = Path.join(root, exports._getAttachmentPath(buffer));
    await FSE.ensureFile(path);
    await FSE.writeFile(path, buffer);
    return path;
  };
};

exports._getAttachmentName = (buffer) => {
  if (!isBuffer(buffer)) {
    throw new TypeError('`buffer` must be a buffer');
  }

  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
};

exports._getAttachmentPath = (buffer) => {
  if (!isBuffer(buffer)) {
    throw new TypeError('`buffer` must be a buffer');
  }

  const name = exports._getAttachmentName(buffer);
  const prefix = name.slice(0, 3);
  return Path.join(prefix, name);
};
