$(document).on('keyup', function(e) {
  if (e.keyCode === 27) {
    window.closePermissionsPopup();
  }
});

const $body = $(document.body);

window.view = new Whisper.ConfirmationDialogView({
  message: i18n('audioPermissionNeeded'),
  okText: i18n('allowAccess'),
  resolve: () => {
    window.setMediaPermissions(true);
    window.closePermissionsPopup();
  },
  reject: window.closePermissionsPopup,
});

window.view.$el.appendTo($body);
