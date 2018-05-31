import os from 'os';
import Sinon from 'sinon';
import { assert } from 'chai';

import * as Settings from '../../../ts/types/Settings';

describe('Settings', () => {
  const sandbox = Sinon.createSandbox();

  describe('isAudioNotificationSupported', () => {
    context('on macOS', () => {
      beforeEach(() => {
        sandbox.stub(process, 'platform').value('darwin');
      });

      afterEach(() => {
        sandbox.restore();
      });

      it('should return true', () => {
        assert.isTrue(Settings.isAudioNotificationSupported());
      });
    });

    context('on Windows', () => {
      context('version 7', () => {
        beforeEach(() => {
          sandbox.stub(process, 'platform').value('win32');
          sandbox.stub(os, 'release').returns('7.0.0');
        });

        afterEach(() => {
          sandbox.restore();
        });

        it('should return false', () => {
          assert.isFalse(Settings.isAudioNotificationSupported());
        });
      });

      context('version 8+', () => {
        beforeEach(() => {
          sandbox.stub(process, 'platform').value('win32');
          sandbox.stub(os, 'release').returns('8.0.0');
        });

        afterEach(() => {
          sandbox.restore();
        });

        it('should return true', () => {
          assert.isTrue(Settings.isAudioNotificationSupported());
        });
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
        assert.isFalse(Settings.isAudioNotificationSupported());
      });
    });
  });

  describe('isNotificationGroupingSupported', () => {
    context('on macOS', () => {
      beforeEach(() => {
        sandbox.stub(process, 'platform').value('darwin');
      });

      afterEach(() => {
        sandbox.restore();
      });

      it('should return true', () => {
        assert.isTrue(Settings.isNotificationGroupingSupported());
      });
    });

    context('on Windows', () => {
      context('version 7', () => {
        beforeEach(() => {
          sandbox.stub(process, 'platform').value('win32');
          sandbox.stub(os, 'release').returns('7.0.0');
        });

        afterEach(() => {
          sandbox.restore();
        });

        it('should return false', () => {
          assert.isFalse(Settings.isNotificationGroupingSupported());
        });
      });

      context('version 8+', () => {
        beforeEach(() => {
          sandbox.stub(process, 'platform').value('win32');
          sandbox.stub(os, 'release').returns('8.0.0');
        });

        afterEach(() => {
          sandbox.restore();
        });

        it('should return true', () => {
          assert.isTrue(Settings.isNotificationGroupingSupported());
        });
      });
    });

    context('on Linux', () => {
      beforeEach(() => {
        sandbox.stub(process, 'platform').value('linux');
      });

      afterEach(() => {
        sandbox.restore();
      });

      it('should return true', () => {
        assert.isTrue(Settings.isNotificationGroupingSupported());
      });
    });
  });
});
