/* global $, i18n */

$(document).on('keyup', e => {
  'use strict';

  if (e.keyCode === 27) {
    window.closePermissionsPopup();
  }
});

window.confirmationDialog({
  title: i18n('audioPermissionNeeded'),
  okText: i18n('allowAccess'),
  resolve: () => {
    'use strict';

    window.setMediaPermissions(true);
    window.closePermissionsPopup();
  },
  onClose: window.closePermissionsPopup,
});
