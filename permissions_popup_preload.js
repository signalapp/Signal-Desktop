/* global window */

const { ipcRenderer, remote } = require('electron');
const url = require('url');
const i18n = require('./js/modules/i18n');
const { makeGetter, makeSetter } = require('./preload_utils');

const { systemPreferences } = remote.require('electron');

const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');

window.getEnvironment = () => config.environment;
window.getVersion = () => config.version;
window.theme = config.theme;
window.i18n = i18n.setup(locale, localeMessages);

function setSystemTheme() {
  window.systemTheme = systemPreferences.isDarkMode() ? 'dark' : 'light';
}

setSystemTheme();

window.subscribeToSystemThemeChange = fn => {
  if (!systemPreferences.subscribeNotification) {
    return;
  }
  systemPreferences.subscribeNotification(
    'AppleInterfaceThemeChangedNotification',
    () => {
      setSystemTheme();
      fn();
    }
  );
};

require('./js/logging');

window.closePermissionsPopup = () =>
  ipcRenderer.send('close-permissions-popup');

window.getMediaPermissions = makeGetter('media-permissions');
window.setMediaPermissions = makeSetter('media-permissions');
window.getThemeSetting = makeGetter('theme-setting');
window.setThemeSetting = makeSetter('theme-setting');
