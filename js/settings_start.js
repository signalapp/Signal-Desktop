/* global $, Whisper */

$(document).on('keydown', e => {
  'use strict';

  if (e.keyCode === 27) {
    window.closeSettings();
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

// eslint-disable-next-line strict
const getInitialData = async () => ({
  deviceName: await window.getDeviceName(),

  themeSetting: await window.getThemeSetting(),
  hideMenuBar: await window.getHideMenuBar(),

  notificationSetting: await window.getNotificationSetting(),
  audioNotification: await window.getAudioNotification(),

  spellCheck: await window.getSpellCheck(),

  incomingCallNotification: await window.getIncomingCallNotification(),
  callRingtoneNotification: await window.getCallRingtoneNotification(),
  callSystemNotification: await window.getCallSystemNotification(),
  alwaysRelayCalls: await window.getAlwaysRelayCalls(),

  mediaPermissions: await window.getMediaPermissions(),
  mediaCameraPermissions: await window.getMediaCameraPermissions(),

  isPrimary: await window.isPrimary(),
  lastSyncTime: await window.getLastSyncTime(),
});

window.initialRequest = getInitialData();

// eslint-disable-next-line more/no-then
window.initialRequest.then(
  data => {
    'use strict';

    window.initialData = data;
    window.view = new Whisper.SettingsView();
    window.view.$el.appendTo($body);
  },
  error => {
    'use strict';

    window.log.error(
      'settings.initialRequest error:',
      error && error.stack ? error.stack : error
    );
    window.closeSettings();
  }
);
