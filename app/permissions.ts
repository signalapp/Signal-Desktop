// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// The list of permissions is here:
//   https://electronjs.org/docs/api/session#sessetpermissionrequesthandlerhandler

import type { session as ElectronSession, Session } from 'electron';

import type { ConfigType } from './base_config';

const PERMISSIONS: Record<string, boolean> = {
  // Allowed
  fullscreen: true, // required to show videos in full-screen
  notifications: true, // required to show OS notifications for new messages
  'clipboard-sanitized-write': true, // required to copy text into clipboard

  // Off by default, can be enabled by user
  media: false, // required for access to microphone and camera, used for voice notes and calling

  // Not allowed
  geolocation: false,
  midiSysex: false,
  openExternal: false, // we don't need this; we open links via 'will-navigate' event
  pointerLock: false,
};

function _createPermissionHandler(
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

      if (
        details.mediaTypes?.includes('audio') ||
        details.mediaTypes?.includes('video')
      ) {
        if (
          details.mediaTypes?.includes('audio') &&
          userConfig.get('mediaPermissions')
        ) {
          callback(true);
          return;
        }
        if (
          details.mediaTypes?.includes('video') &&
          userConfig.get('mediaCameraPermissions')
        ) {
          callback(true);
          return;
        }

        callback(false);
        return;
      }

      // If it doesn't have 'video' or 'audio', it's probably screenshare.
      // TODO: DESKTOP-1611
      callback(true);
      return;
    }

    if (PERMISSIONS[permission]) {
      console.log(`Approving request for permission '${permission}'`);
      callback(true);
      return;
    }

    console.log(`Denying request for permission '${permission}'`);
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
