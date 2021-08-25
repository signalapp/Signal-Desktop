// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  protocol as ElectronProtocol,
  ProtocolRequest,
  ProtocolResponse,
} from 'electron';

import { isAbsolute, normalize } from 'path';
import { existsSync, realpathSync } from 'fs';

type CallbackType = (response: string | ProtocolResponse) => void;

function _eliminateAllAfterCharacter(
  string: string,
  character: string
): string {
  const index = string.indexOf(character);
  if (index < 0) {
    return string;
  }

  return string.slice(0, index);
}

export function _urlToPath(
  targetUrl: string,
  options?: { isWindows: boolean }
): string {
  const decoded = decodeURIComponent(targetUrl);
  const withoutScheme = decoded.slice(options?.isWindows ? 8 : 7);
  const withoutQuerystring = _eliminateAllAfterCharacter(withoutScheme, '?');
  const withoutHash = _eliminateAllAfterCharacter(withoutQuerystring, '#');

  return withoutHash;
}

function _createFileHandler({
  userDataPath,
  installPath,
  isWindows,
}: {
  userDataPath: string;
  installPath: string;
  isWindows: boolean;
}) {
  return (request: ProtocolRequest, callback: CallbackType): void => {
    let targetPath;

    if (!request.url) {
      // This is an "invalid URL" error. See [Chromium's net error list][0].
      //
      // [0]: https://source.chromium.org/chromium/chromium/src/+/master:net/base/net_error_list.h;l=563;drc=a836ee9868cf1b9673fce362a82c98aba3e195de
      callback({ error: -300 });
      return;
    }

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

      callback({ error: -300 });
      return;
    }
    // normalize() is primarily useful here for switching / to \ on windows
    const target = normalize(targetPath);
    // here we attempt to follow symlinks to the ultimate final path, reflective of what
    //   we do in main.js on userDataPath and installPath
    const realPath = existsSync(target) ? realpathSync(target) : target;
    // finally we do case-insensitive checks on windows
    const properCasing = isWindows ? realPath.toLowerCase() : realPath;

    if (!isAbsolute(realPath)) {
      console.log(
        `Warning: denying request to non-absolute path '${realPath}'`
      );
      // This is an "Access Denied" error. See [Chromium's net error list][0].
      //
      // [0]: https://source.chromium.org/chromium/chromium/src/+/master:net/base/net_error_list.h;l=57;drc=a836ee9868cf1b9673fce362a82c98aba3e195de
      callback({ error: -10 });
      return;
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
      callback({ error: -10 });
      return;
    }

    callback({
      path: realPath,
    });
  };
}

export function installFileHandler({
  protocol,
  userDataPath,
  installPath,
  isWindows,
}: {
  protocol: typeof ElectronProtocol;
  userDataPath: string;
  installPath: string;
  isWindows: boolean;
}): void {
  protocol.interceptFileProtocol(
    'file',
    _createFileHandler({ userDataPath, installPath, isWindows })
  );
}

// Turn off browser URI scheme since we do all network requests via Node.js
function _disabledHandler(
  _request: ProtocolRequest,
  callback: CallbackType
): void {
  callback({ error: -10 });
}

export function installWebHandler({
  protocol,
  enableHttp,
}: {
  protocol: typeof ElectronProtocol;
  enableHttp: string;
}): void {
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
