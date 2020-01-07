/* global $, Whisper, i18n */

$(document).on('keydown', e => {
  'use strict';

  if (e.keyCode === 27) {
    window.closePermissionsPopup();
  }
});

const $body = $(document.body);

async function applyTheme() {
  'use strict';

  const theme = await window.getThemeSetting();
  $body.removeClass('light-theme');
  $body.removeClass('dark-theme');
  $body.addClass(`${theme === 'system' ? window.systemTheme : theme}-theme`);
}

applyTheme();

window.subscribeToSystemThemeChange(() => {
  'use strict';

  applyTheme();
});

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
