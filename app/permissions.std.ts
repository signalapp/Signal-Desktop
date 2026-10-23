// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// The list of permissions is here:
//   https://electronjs.org/docs/api/session#sessetpermissionrequesthandlerhandler

import type { session as ElectronSession, Session } from 'electron';

import type { ConfigType } from './base_config.node.ts';
import { createLogger } from '../ts/logging/log.std.ts';

const log = createLogger('permissions');

const PERMISSIONS: Record<string, boolean> = {
  // Allowed
  fullscreen: true, // required to show videos in full-screen
  notifications: true, // required to show OS notifications for new messages
  'clipboard-sanitized-write': true, // required to copy text into clipboard
  'display-capture': true, // required for screen sharing; TODO: DESKTOP-1611

  // Off by default, can be enabled by user
  media: false, // required for access to microphone and camera, used for voice notes and calling

  // Not allowed
  geolocation: false,
  midiSysex: false,
  openExternal: false, // we don't need this; we open links via 'will-navigate' event
  pointerLock: false,
};

export function _createPermissionHandler(
  userConfig: Pick<ConfigType, 'get'>
): Parameters<typeof ElectronSession.prototype.setPermissionRequestHandler>[0] {
  return (_webContents, permission, callback, details): void => {
    // We default 'media' permission to false, but the user can override that for
    // the microphone and camera.
    if (permission === 'media') {
      // Pacifying typescript because it is always there for 'media' permission
      if (!('mediaTypes' in details)) {
        callback(false);
        return;
      }

      const wantsAudio = details.mediaTypes?.includes('audio') ?? false;
      const wantsVideo = details.mediaTypes?.includes('video') ?? false;

      if (!wantsAudio && !wantsVideo) {
        callback(false);
        return;
      }
      if (wantsAudio && !userConfig.get('mediaPermissions')) {
        callback(false);
        return;
      }
      if (wantsVideo && !userConfig.get('mediaCameraPermissions')) {
        callback(false);
        return;
      }

      callback(true);
      return;
    }

    if (PERMISSIONS[permission]) {
      log.info(`Approving request for permission '${permission}'`);
      callback(true);
      return;
    }

    log.info(`Denying request for permission '${permission}'`);
    callback(false);
  };
}

export function installPermissionsHandler({
  session,
  userConfig,
}: {
  session: Session;
  userConfig: Pick<ConfigType, 'get'>;
}): void {
  // Setting the permission request handler to null first forces any permissions to be
  //   requested again. Without this, revoked permissions might still be available if
  //   they've already been used successfully.
  session.setPermissionRequestHandler(null);

  session.setPermissionRequestHandler(_createPermissionHandler(userConfig));
}
