const { assert } = require('chai');

const SignalMenu = require('../../app/menu');
const { load: loadLocale } = require('../../app/locale');

const FIXTURE_MENU_MAC_OS = require('./fixtures/menu-mac-os');
const FIXTURE_MENU_WINDOWS_LINUX = require('./fixtures/menu-windows-linux');

const PLATFORMS = [
  {
    label: 'macOS',
    platform: 'darwin',
    fixture: FIXTURE_MENU_MAC_OS,
  },
  {
    label: 'Windows',
    platform: 'win32',
    fixture: FIXTURE_MENU_WINDOWS_LINUX,
  },
  {
    label: 'Linux',
    platform: 'linux',
    fixture: FIXTURE_MENU_WINDOWS_LINUX,
  },
];

const INCLUDE_SETUP_OPTIONS = [false];

describe('SignalMenu', () => {
  describe('createTemplate', () => {
    PLATFORMS.forEach(({ label, platform, fixture }) => {
      context(label, () => {
        INCLUDE_SETUP_OPTIONS.forEach((includeSetup) => {
          const prefix = includeSetup ? 'with' : 'without';
          context(`${prefix} included setup`, () => {
            it('should return correct template', () => {
              const logger = {
                error(message) {
                  throw new Error(message);
                },
              };
              const options = {
                openForums: null,
                openNewBugForm: null,
                openReleaseNotes: null,
                openSupportPage: null,
                platform,
                includeSetup,
                setupAsNewDevice: null,
                setupAsStandalone: null,
                setupWithImport: null,
                showAbout: null,
                showDebugLog: null,
                showSettings: null,
                showWindow: null,
              };
              const appLocale = 'en';
              const { messages } = loadLocale({ appLocale, logger });

              const actual = SignalMenu.createTemplate(options, messages);
              assert.deepEqual(actual, fixture);
            });
          });
        });
      });
    });
  });
});
