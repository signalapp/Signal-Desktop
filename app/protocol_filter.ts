// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ProtocolRequest, ProtocolResponse, Session } from 'electron';

import { isAbsolute, normalize } from 'path';
import { existsSync, realpathSync } from 'fs';
import {
  getAvatarsPath,
  getBadgesPath,
  getDraftPath,
  getDownloadsPath,
  getPath,
  getStickersPath,
  getTempPath,
  getUpdateCachePath,
} from './attachments';

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

  // We generally expect URLs to start with file:// or file:/// here, but for users with
  //   their home directory redirected to a UNC share, it will start with //.
  const withoutScheme = decoded.startsWith('//')
    ? decoded
    : decoded.slice(options?.isWindows ? 8 : 7);

  const withoutQuerystring = _eliminateAllAfterCharacter(withoutScheme, '?');

  return withoutQuerystring;
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
  const allowedRoots = [
    userDataPath,
    installPath,
    getAvatarsPath(userDataPath),
    getBadgesPath(userDataPath),
    getDraftPath(userDataPath),
    getDownloadsPath(userDataPath),
    getPath(userDataPath),
    getStickersPath(userDataPath),
    getTempPath(userDataPath),
    getUpdateCachePath(userDataPath),
  ];
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

      for (const root of allowedRoots) {
        if (properCasing.startsWith(isWindows ? root.toLowerCase() : root)) {
          callback({ path: realPath });
          return;
        }
      }

      console.log(
        `Warning: denying request to path '${realPath}' (allowedRoots: '${allowedRoots}')`
      );
      callback({ error: -10 });
    } catch (err) {
      const errorMessage =
        err && typeof err.message === 'string'
          ? err.message
          : 'no error message';
      console.log(
        `Warning: denying request because of an error: ${errorMessage}`
      );

      callback({ error: -300 });
    }
  };
}

export function installFileHandler({
  session,
  userDataPath,
  installPath,
  isWindows,
}: {
  session: Session;
  userDataPath: string;
  installPath: string;
  isWindows: boolean;
}): void {
  session.protocol.interceptFileProtocol(
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
  session,
  enableHttp,
}: {
  session: Session;
  enableHttp: boolean;
}): void {
  const { protocol } = session;
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
