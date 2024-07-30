// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import os from 'os';
import Sinon from 'sinon';
import { assert } from 'chai';

import { getOSFunctions } from '../../util/os/shared';
import * as Settings from '../../types/Settings';
import { SystemTraySetting } from '../../types/SystemTraySetting';

describe('Settings', () => {
  let sandbox: Sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = Sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
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
      assert.isFalse(Settings.isSystemTraySupported(OS));
    });

    it('returns true on Windows 8', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('8.0.0');
      const OS = getOSFunctions(os.release());
      assert.isTrue(Settings.isSystemTraySupported(OS));
    });

    it('returns true on Linux', () => {
      sandbox.stub(process, 'platform').value('linux');
      const OS = getOSFunctions(os.release());
      assert.isTrue(Settings.isSystemTraySupported(OS));
    });
  });

  describe('getDefaultSystemTraySetting', () => {
    it('returns DoNotUseSystemTray is unsupported OS', () => {
      sandbox.stub(process, 'platform').value('darwin');
      const OS = getOSFunctions(os.release());
      assert.strictEqual(
        Settings.getDefaultSystemTraySetting(OS, '1.2.3'),
        SystemTraySetting.DoNotUseSystemTray
      );
    });

    it('returns MinimizeToSystemTray on Windows 8', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('8.0.0');
      const OS = getOSFunctions(os.release());
      assert.strictEqual(
        Settings.getDefaultSystemTraySetting(OS, '1.2.3'),
        SystemTraySetting.MinimizeToSystemTray
      );
    });

    it('returns MinimizeToSystemTray on Linux Beta', () => {
      sandbox.stub(process, 'platform').value('linux');
      const OS = getOSFunctions(os.release());
      assert.strictEqual(
        Settings.getDefaultSystemTraySetting(OS, '1.2.3-beta.1'),
        SystemTraySetting.MinimizeToSystemTray
      );
    });

    it('returns DoNotUseSystemTray on Linux Prod', () => {
      sandbox.stub(process, 'platform').value('linux');
      const OS = getOSFunctions(os.release());
      assert.strictEqual(
        Settings.getDefaultSystemTraySetting(OS, '1.2.3'),
        SystemTraySetting.DoNotUseSystemTray
      );
    });
  });
});
