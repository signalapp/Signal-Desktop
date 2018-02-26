const sinon = require('sinon');
const { assert } = require('chai');

const Settings = require('../../../js/modules/types/settings');


describe('Settings', () => {
  const sandbox = sinon.createSandbox();

  describe('shouldShowAudioNotificationSetting', () => {
    context('on macOS', () => {
      beforeEach(() => {
        sandbox.stub(process, 'platform').value('darwin');
      });

      afterEach(() => {
        sandbox.restore();
      });

      it('should return true', () => {
        assert.isTrue(Settings.shouldShowAudioNotificationSetting());
      });
    });

    context('on Windows', () => {
      beforeEach(() => {
        sandbox.stub(process, 'platform').value('win32');
      });

      afterEach(() => {
        sandbox.restore();
      });

      it('should return true', () => {
        assert.isTrue(Settings.shouldShowAudioNotificationSetting());
      });
    });

    context('on Linux', () => {
      beforeEach(() => {
        sandbox.stub(process, 'platform').value('linux');
      });

      afterEach(() => {
        sandbox.restore();
      });

      it('should return false', () => {
        assert.isFalse(Settings.shouldShowAudioNotificationSetting());
      });
    });
  });
});
