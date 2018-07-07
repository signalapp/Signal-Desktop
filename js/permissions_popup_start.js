/* global $, Whisper, i18n */

$(document).on('keyup', e => {
  'use strict';

  if (e.keyCode === 27) {
    window.closePermissionsPopup();
  }
});

const $body = $(document.body);
$body.addClass(`${window.theme}-theme`);

window.view = new Whisper.ConfirmationDialogView({
  message: i18n('audioPermissionNeeded'),
  okText: i18n('allowAccess'),
  resolve: () => {
    'use strict';

    window.setMediaPermissions(true);
    window.closePermissionsPopup();
  },
  reject: window.closePermissionsPopup,
});

window.view.$el.appendTo($body);
