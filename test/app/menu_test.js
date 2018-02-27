const { assert } = require('chai');

const SignalMenu = require('../../app/menu');
const { load: loadLocale } = require('../../app/locale');


const PLATFORMS = [
  {
    label: 'macOS',
    platform: 'darwin',
    fixtures: {
      default: './fixtures/menu-mac-os',
      setup: './fixtures/menu-mac-os-setup',
    },
  },
  {
    label: 'Windows',
    platform: 'win32',
    fixtures: {
      default: './fixtures/menu-windows-linux',
      setup: './fixtures/menu-windows-linux-setup',
    },
  },
  {
    label: 'Linux',
    platform: 'linux',
    fixtures: {
      default: './fixtures/menu-windows-linux',
      setup: './fixtures/menu-windows-linux-setup',
    },
  },
];

const INCLUDE_SETUP_OPTIONS = [false, true];

describe('SignalMenu', () => {
  describe('createTemplate', () => {
    PLATFORMS.forEach(({ label, platform, fixtures }) => {
      context(label, () => {
        INCLUDE_SETUP_OPTIONS.forEach((includeSetup) => {
          const prefix = includeSetup ? 'with' : 'without';
          context(`${prefix} setup options`, () => {
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
              const fixturePath = includeSetup ? fixtures.setup : fixtures.default;
              // eslint-disable-next-line global-require, import/no-dynamic-require
              const fixture = require(fixturePath);
              assert.deepEqual(actual, fixture);
            });
          });
        });
      });
    });
  });
});
