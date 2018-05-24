// The list of permissions is here:
//   https://electronjs.org/docs/api/session#sessetpermissionrequesthandlerhandler

const PERMISSIONS = {
  // Allowed
  fullscreen: true, // required to show videos in full-screen
  media: true, // required for access to microphone, used for voice notes
  notifications: true, // required to show OS notifications for new messages

  // Not allowed
  geolocation: false,
  midiSysex: false,
  openExternal: false, // we don't need this; we open links via 'will-navigate' event
  pointerLock: false,
};

function _permissionHandler(webContents, permission, callback) {
  if (PERMISSIONS[permission]) {
    console.log(`Approving request for permission '${permission}'`);
    return callback(true);
  }

  console.log(`Denying request for permission '${permission}'`);
  return callback(false);
}

function installPermissionsHandler({ session }) {
  session.defaultSession.setPermissionRequestHandler(_permissionHandler);
}

module.exports = {
  installPermissionsHandler,
};
