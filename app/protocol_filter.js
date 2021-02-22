// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const path = require('path');
const fs = require('fs');

function _eliminateAllAfterCharacter(string, character) {
  const index = string.indexOf(character);
  if (index < 0) {
    return string;
  }

  return string.slice(0, index);
}

function _urlToPath(targetUrl, options = {}) {
  const { isWindows } = options;

  const decoded = decodeURIComponent(targetUrl);
  const withoutScheme = decoded.slice(isWindows ? 8 : 7);
  const withoutQuerystring = _eliminateAllAfterCharacter(withoutScheme, '?');
  const withoutHash = _eliminateAllAfterCharacter(withoutQuerystring, '#');

  return withoutHash;
}

function _createFileHandler({ userDataPath, installPath, isWindows }) {
  return (request, callback) => {
    let targetPath;
    try {
      targetPath = _urlToPath(request.url, { isWindows });
    } catch (err) {
      const errorMessage =
        err && typeof err.message === 'string'
          ? err.message
          : 'no error message';
      console.log(
        `Warning: denying request because of an error: ${errorMessage}`
      );

      // This is an "invalid URL" error. See [Chromium's net error list][0].
      //
      // [0]: https://source.chromium.org/chromium/chromium/src/+/master:net/base/net_error_list.h;l=563;drc=a836ee9868cf1b9673fce362a82c98aba3e195de
      return callback({ error: -300 });
    }
    // normalize() is primarily useful here for switching / to \ on windows
    const target = path.normalize(targetPath);
    // here we attempt to follow symlinks to the ultimate final path, reflective of what
    //   we do in main.js on userDataPath and installPath
    const realPath = fs.existsSync(target) ? fs.realpathSync(target) : target;
    // finally we do case-insensitive checks on windows
    const properCasing = isWindows ? realPath.toLowerCase() : realPath;

    if (!path.isAbsolute(realPath)) {
      console.log(
        `Warning: denying request to non-absolute path '${realPath}'`
      );
      return callback();
    }

    if (
      !properCasing.startsWith(
        isWindows ? userDataPath.toLowerCase() : userDataPath
      ) &&
      !properCasing.startsWith(
        isWindows ? installPath.toLowerCase() : installPath
      )
    ) {
      console.log(
        `Warning: denying request to path '${realPath}' (userDataPath: '${userDataPath}', installPath: '${installPath}')`
      );
      return callback();
    }

    return callback({
      path: realPath,
    });
  };
}

function installFileHandler({
  protocol,
  userDataPath,
  installPath,
  isWindows,
}) {
  protocol.interceptFileProtocol(
    'file',
    _createFileHandler({ userDataPath, installPath, isWindows })
  );
}

// Turn off browser URI scheme since we do all network requests via Node.js
function _disabledHandler(request, callback) {
  return callback();
}

function installWebHandler({ protocol, enableHttp }) {
  protocol.interceptFileProtocol('about', _disabledHandler);
  protocol.interceptFileProtocol('content', _disabledHandler);
  protocol.interceptFileProtocol('chrome', _disabledHandler);
  protocol.interceptFileProtocol('cid', _disabledHandler);
  protocol.interceptFileProtocol('data', _disabledHandler);
  protocol.interceptFileProtocol('filesystem', _disabledHandler);
  protocol.interceptFileProtocol('ftp', _disabledHandler);
  protocol.interceptFileProtocol('gopher', _disabledHandler);
  protocol.interceptFileProtocol('javascript', _disabledHandler);
  protocol.interceptFileProtocol('mailto', _disabledHandler);

  if (!enableHttp) {
    protocol.interceptFileProtocol('http', _disabledHandler);
    protocol.interceptFileProtocol('https', _disabledHandler);
    protocol.interceptFileProtocol('ws', _disabledHandler);
    protocol.interceptFileProtocol('wss', _disabledHandler);
  }
}

module.exports = {
  _urlToPath,
  installFileHandler,
  installWebHandler,
};
