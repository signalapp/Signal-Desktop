const { assert } = require('chai');

const SignalMenu = require('../../app/menu');
const { load: loadLocale } = require('../../app/locale');

const FIXTURE_MAC_OS_MENU = require('./fixtures/menu-mac-os');


describe('SignalMenu', () => {
  describe('createTemplate', () => {
    context('on macOS', () => {
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
          platform: 'darwin',
          setupAsNewDevice: null,
          setupAsStandalone: null,
          setupWithImport: null,
          showAbout: null,
          showDebugLog: null,
          showWindow: null,
        };
        const appLocale = 'en';
        const { messages } = loadLocale({ appLocale, logger });

        const actual = SignalMenu.createTemplate(options, messages);
        assert.deepEqual(actual, FIXTURE_MAC_OS_MENU);
      });
    });
  });
});
