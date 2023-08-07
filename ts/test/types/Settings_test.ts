import os from 'os';
import Sinon from 'sinon';
import { assert } from 'chai';

import * as Settings from '../../types/Settings';

describe('Settings', () => {
  describe('isAudioNotificationSupported', () => {
    context('on macOS', () => {
      beforeEach(() => {
        Sinon.stub(process, 'platform').value('darwin');
      });

      afterEach(() => {
        Sinon.restore();
      });

      it('should return true', () => {
        assert.isTrue(Settings.isAudioNotificationSupported());
      });
    });

    context('on Windows', () => {
      context('version 7', () => {
        beforeEach(() => {
          Sinon.stub(process, 'platform').value('win32');
          Sinon.stub(os, 'release').returns('7.0.0');
        });

        afterEach(() => {
          Sinon.restore();
        });

        it('should return false', () => {
          assert.isFalse(Settings.isAudioNotificationSupported());
        });
      });

      context('version 8+', () => {
        beforeEach(() => {
          Sinon.stub(process, 'platform').value('win32');
          Sinon.stub(os, 'release').returns('8.0.0');
        });

        afterEach(() => {
          Sinon.restore();
        });

        it('should return true', () => {
          assert.isTrue(Settings.isAudioNotificationSupported());
        });
      });
    });

    context('on Linux', () => {
      beforeEach(() => {
        Sinon.stub(process, 'platform').value('linux');
      });

      afterEach(() => {
        Sinon.restore();
      });

      it('should return true', () => {
        assert.isTrue(Settings.isAudioNotificationSupported());
      });
    });
  });

  describe('isNotificationGroupingSupported', () => {
    context('on macOS', () => {
      beforeEach(() => {
        Sinon.stub(process, 'platform').value('darwin');
      });

      afterEach(() => {
        Sinon.restore();
      });

      it('should return true', () => {
        assert.isTrue(Settings.isNotificationGroupingSupported());
      });
    });

    context('on Windows', () => {
      context('version 7', () => {
        beforeEach(() => {
          Sinon.stub(process, 'platform').value('win32');
          Sinon.stub(os, 'release').returns('7.0.0');
        });

        afterEach(() => {
          Sinon.restore();
        });

        it('should return false', () => {
          assert.isFalse(Settings.isNotificationGroupingSupported());
        });
      });

      context('version 8+', () => {
        beforeEach(() => {
          Sinon.stub(process, 'platform').value('win32');
          Sinon.stub(os, 'release').returns('8.0.0');
        });

        afterEach(() => {
          Sinon.restore();
        });

        it('should return true', () => {
          assert.isTrue(Settings.isNotificationGroupingSupported());
        });
      });
    });

    context('on Linux', () => {
      beforeEach(() => {
        Sinon.stub(process, 'platform').value('linux');
      });

      afterEach(() => {
        Sinon.restore();
      });

      it('should return true', () => {
        assert.isTrue(Settings.isNotificationGroupingSupported());
      });
    });
  });
  describe('isHideMenuBarSupported', () => {
    context('on macOS', () => {
      beforeEach(() => {
        Sinon.stub(process, 'platform').value('darwin');
      });

      afterEach(() => {
        Sinon.restore();
      });

      it('should return false', () => {
        assert.isFalse(Settings.isHideMenuBarSupported());
      });
    });

    context('on Windows', () => {
      context('version 7', () => {
        beforeEach(() => {
          Sinon.stub(process, 'platform').value('win32');
          Sinon.stub(os, 'release').returns('7.0.0');
        });

        afterEach(() => {
          Sinon.restore();
        });

        it('should return true', () => {
          assert.isTrue(Settings.isHideMenuBarSupported());
        });
      });

      context('version 8+', () => {
        beforeEach(() => {
          Sinon.stub(process, 'platform').value('win32');
          Sinon.stub(os, 'release').returns('8.0.0');
        });

        afterEach(() => {
          Sinon.restore();
        });

        it('should return true', () => {
          assert.isTrue(Settings.isHideMenuBarSupported());
        });
      });
    });

    context('on Linux', () => {
      beforeEach(() => {
        Sinon.stub(process, 'platform').value('linux');
      });

      afterEach(() => {
        Sinon.restore();
      });

      it('should return true', () => {
        assert.isTrue(Settings.isHideMenuBarSupported());
      });
    });
  });
});
