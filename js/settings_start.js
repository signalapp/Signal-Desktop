$(document).on('keyup', function(e) {
  if (e.keyCode === 27) {
    window.closeSettings();
  }
});

const $body = $(document.body);

const getInitialData = async () => ({
  deviceName: await window.getDeviceName(),

  themeSetting: await window.getThemeSetting(),
  hideMenuBar: await window.getHideMenuBar(),

  notificationSetting: await window.getNotificationSetting(),
  audioNotification: await window.getAudioNotification(),

  mediaPermissions: await window.getMediaPermissions(),

  isPrimary: await window.isPrimary(),
  lastSyncTime: await window.getLastSyncTime(),
});

window.initialRequest = getInitialData();
window.initialRequest.then(data => {
  window.initialData = data;
  window.view = new Whisper.SettingsView();
  window.view.$el.appendTo($body);
});
