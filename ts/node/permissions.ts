// The list of permissions is here:
//   https://electronjs.org/docs/api/session#sessetpermissionrequesthandlerhandler
import { session } from 'electron';

import { UserConfig } from './config/user_config';

const PERMISSIONS: Record<string, boolean> = {
  // Allowed
  fullscreen: true, // required to show videos in full-screen
  notifications: true, // required to show OS notifications for new messages

  // Off by default, can be enabled by user
  media: false, // required for access to microphone, used for voice notes

  // Not allowed
  geolocation: false,
  midiSysex: false,
  openExternal: false, // we don't need this; we open links via 'will-navigate' event
  pointerLock: false,
};

function createPermissionHandler(userConfig: UserConfig) {
  return (_webContents: any, permission: any, callback: any) => {
    // We default 'media' permission to false, but the user can override that
    if (permission === 'media' && userConfig.get('mediaPermissions')) {
      return callback(true);
    }

    if (PERMISSIONS[permission]) {
      console.log(`Approving request for permission '${permission}'`);
      return callback(true);
    }

    console.log(`Denying request for permission '${permission}'`);
    return callback(false);
  };
}

export function installPermissionsHandler({ userConfig }: { userConfig: UserConfig }) {
  // Setting the permission request handler to null first forces any permissions to be
  //   requested again. Without this, revoked permissions might still be available if
  //   they've already been used successfully.
  session.defaultSession.setPermissionRequestHandler(null);

  session.defaultSession.setPermissionRequestHandler(createPermissionHandler(userConfig));
}
