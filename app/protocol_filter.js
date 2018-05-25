const path = require('path');

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
    // normalize() is primarily useful here for switching / to \ on windows
    const target = path.normalize(_urlToPath(request.url, { isWindows }));

    if (!path.isAbsolute(target)) {
      return callback();
    }

    if (!target.startsWith(userDataPath) && !target.startsWith(installPath)) {
      console.log(`Warning: denying request to ${target}`);
      return callback();
    }

    return callback({
      path: target,
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

function installWebHandler({ protocol }) {
  protocol.interceptFileProtocol('about', _disabledHandler);
  protocol.interceptFileProtocol('content', _disabledHandler);
  protocol.interceptFileProtocol('chrome', _disabledHandler);
  protocol.interceptFileProtocol('cid', _disabledHandler);
  protocol.interceptFileProtocol('data', _disabledHandler);
  protocol.interceptFileProtocol('filesystem', _disabledHandler);
  protocol.interceptFileProtocol('ftp', _disabledHandler);
  protocol.interceptFileProtocol('gopher', _disabledHandler);
  protocol.interceptFileProtocol('http', _disabledHandler);
  protocol.interceptFileProtocol('https', _disabledHandler);
  protocol.interceptFileProtocol('javascript', _disabledHandler);
  protocol.interceptFileProtocol('mailto', _disabledHandler);
  protocol.interceptFileProtocol('ws', _disabledHandler);
  protocol.interceptFileProtocol('wss', _disabledHandler);
}

module.exports = {
  _urlToPath,
  installFileHandler,
  installWebHandler,
};
