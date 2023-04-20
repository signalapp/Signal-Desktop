// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import os from 'os';
import Sinon from 'sinon';
import { assert } from 'chai';

import { getOSFunctions } from '../../util/os/shared';
import * as Settings from '../../types/Settings';

describe('Settings', () => {
  let sandbox: Sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = Sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getAudioNotificationSupport', () => {
    it('returns native support on macOS', () => {
      sandbox.stub(process, 'platform').value('darwin');
      const OS = getOSFunctions(os.release());
      assert.strictEqual(
        Settings.getAudioNotificationSupport(OS),
        Settings.AudioNotificationSupport.Native
      );
    });

    it('returns no support on Windows 7', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('7.0.0');
      const OS = getOSFunctions(os.release());
      assert.strictEqual(
        Settings.getAudioNotificationSupport(OS),
        Settings.AudioNotificationSupport.None
      );
    });

    it('returns native support on Windows 8', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('8.0.0');
      const OS = getOSFunctions(os.release());
      assert.strictEqual(
        Settings.getAudioNotificationSupport(OS),
        Settings.AudioNotificationSupport.Native
      );
    });

    it('returns custom support on Linux', () => {
      sandbox.stub(process, 'platform').value('linux');
      const OS = getOSFunctions(os.release());
      assert.strictEqual(
        Settings.getAudioNotificationSupport(OS),
        Settings.AudioNotificationSupport.Custom
      );
    });
  });

  describe('isAudioNotificationSupported', () => {
    it('returns true on macOS', () => {
      sandbox.stub(process, 'platform').value('darwin');
      const OS = getOSFunctions(os.release());
      assert.isTrue(Settings.isAudioNotificationSupported(OS));
    });

    it('returns false on Windows 7', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('7.0.0');
      const OS = getOSFunctions(os.release());
      assert.isFalse(Settings.isAudioNotificationSupported(OS));
    });

    it('returns true on Windows 8', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('8.0.0');
      const OS = getOSFunctions(os.release());
      assert.isTrue(Settings.isAudioNotificationSupported(OS));
    });

    it('returns true on Linux', () => {
      sandbox.stub(process, 'platform').value('linux');
      const OS = getOSFunctions(os.release());
      assert.isTrue(Settings.isAudioNotificationSupported(OS));
    });
  });

  describe('isNotificationGroupingSupported', () => {
    it('returns true on macOS', () => {
      sandbox.stub(process, 'platform').value('darwin');
      const OS = getOSFunctions(os.release());
      assert.isTrue(Settings.isNotificationGroupingSupported(OS));
    });

    it('returns true on Windows 7', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('7.0.0');
      const OS = getOSFunctions(os.release());
      assert.isFalse(Settings.isNotificationGroupingSupported(OS));
    });

    it('returns true on Windows 8', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('8.0.0');
      const OS = getOSFunctions(os.release());
      assert.isTrue(Settings.isNotificationGroupingSupported(OS));
    });

    it('returns true on Linux', () => {
      sandbox.stub(process, 'platform').value('linux');
      const OS = getOSFunctions(os.release());
      assert.isTrue(Settings.isNotificationGroupingSupported(OS));
    });
  });

  describe('isAutoLaunchSupported', () => {
    it('returns true on Windows', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('8.0.0');
      const OS = getOSFunctions(os.release());
      assert.isTrue(Settings.isAutoLaunchSupported(OS));
    });

    it('returns true on macOS', () => {
      sandbox.stub(process, 'platform').value('darwin');
      const OS = getOSFunctions(os.release());
      assert.isTrue(Settings.isAutoLaunchSupported(OS));
    });

    it('returns false on Linux', () => {
      sandbox.stub(process, 'platform').value('linux');
      const OS = getOSFunctions(os.release());
      assert.isFalse(Settings.isAutoLaunchSupported(OS));
    });
  });

  describe('isHideMenuBarSupported', () => {
    it('returns false on macOS', () => {
      sandbox.stub(process, 'platform').value('darwin');
      const OS = getOSFunctions(os.release());
      assert.isFalse(Settings.isHideMenuBarSupported(OS));
    });

    it('returns true on Windows 7', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('7.0.0');
      const OS = getOSFunctions(os.release());
      assert.isTrue(Settings.isHideMenuBarSupported(OS));
    });

    it('returns true on Windows 8', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('8.0.0');
      const OS = getOSFunctions(os.release());
      assert.isTrue(Settings.isHideMenuBarSupported(OS));
    });

    it('returns true on Linux', () => {
      sandbox.stub(process, 'platform').value('linux');
      const OS = getOSFunctions(os.release());
      assert.isTrue(Settings.isHideMenuBarSupported(OS));
    });
  });

  describe('isDrawAttentionSupported', () => {
    it('returns false on macOS', () => {
      sandbox.stub(process, 'platform').value('darwin');
      const OS = getOSFunctions(os.release());
      assert.isFalse(Settings.isDrawAttentionSupported(OS));
    });

    it('returns true on Windows 7', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('7.0.0');
      const OS = getOSFunctions(os.release());
      assert.isTrue(Settings.isDrawAttentionSupported(OS));
    });

    it('returns true on Windows 8', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('8.0.0');
      const OS = getOSFunctions(os.release());
      assert.isTrue(Settings.isDrawAttentionSupported(OS));
    });

    it('returns true on Linux', () => {
      sandbox.stub(process, 'platform').value('linux');
      const OS = getOSFunctions(os.release());
      assert.isTrue(Settings.isDrawAttentionSupported(OS));
    });
  });

  describe('isSystemTraySupported', () => {
    it('returns false on macOS', () => {
      sandbox.stub(process, 'platform').value('darwin');
      const OS = getOSFunctions(os.release());
      assert.isFalse(Settings.isSystemTraySupported(OS, '1.2.3'));
    });

    it('returns true on Windows 8', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('8.0.0');
      const OS = getOSFunctions(os.release());
      assert.isTrue(Settings.isSystemTraySupported(OS, '1.2.3'));
    });

    it('returns false on Linux production', () => {
      sandbox.stub(process, 'platform').value('linux');
      const OS = getOSFunctions(os.release());
      assert.isFalse(Settings.isSystemTraySupported(OS, '1.2.3'));
    });

    it('returns true on Linux beta', () => {
      sandbox.stub(process, 'platform').value('linux');
      const OS = getOSFunctions(os.release());
      assert.isTrue(Settings.isSystemTraySupported(OS, '1.2.3-beta.4'));
    });
  });
});
