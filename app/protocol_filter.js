const path = require('path');

const FILE_SCHEME = /^file:\/\//;
const WINDOWS_PREFIX = /^\/[A-Z]:/;
function _urlToPath(targetUrl) {
  let withoutScheme = targetUrl.replace(FILE_SCHEME, '');
  if (WINDOWS_PREFIX.test(withoutScheme)) {
    withoutScheme = withoutScheme.slice(1);
  }

  const withoutQuerystring = withoutScheme.replace(/\?.*$/, '');
  const withoutHash = withoutQuerystring.replace(/#.*$/, '');

  return decodeURIComponent(withoutHash);
}

function _createFileHandler({ userDataPath, installPath }) {
  return (request, callback) => {
    // normalize() is primarily useful here for switching / to \ on windows
    const target = path.normalize(_urlToPath(request.url));

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

function installFileHandler({ protocol, userDataPath, installPath }) {
  protocol.interceptFileProtocol(
    'file',
    _createFileHandler({ userDataPath, installPath })
  );
}

// Turn off all browser web requests since we do all web requests via Node.js
function _webHandler(request, callback) {
  return callback();
}

function installWebHandler({ protocol }) {
  protocol.interceptFileProtocol('http', _webHandler);
  protocol.interceptFileProtocol('https', _webHandler);
  protocol.interceptFileProtocol('ftp', _webHandler);
}

module.exports = {
  _urlToPath,
  installFileHandler,
  installWebHandler,
};
