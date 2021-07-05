// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import os from 'os';
import Sinon from 'sinon';
import { assert } from 'chai';

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
      assert.strictEqual(
        Settings.getAudioNotificationSupport(),
        Settings.AudioNotificationSupport.Native
      );
    });

    it('returns no support on Windows 7', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('7.0.0');
      assert.strictEqual(
        Settings.getAudioNotificationSupport(),
        Settings.AudioNotificationSupport.None
      );
    });

    it('returns native support on Windows 8', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('8.0.0');
      assert.strictEqual(
        Settings.getAudioNotificationSupport(),
        Settings.AudioNotificationSupport.Native
      );
    });

    it('returns custom support on Linux', () => {
      sandbox.stub(process, 'platform').value('linux');
      assert.strictEqual(
        Settings.getAudioNotificationSupport(),
        Settings.AudioNotificationSupport.Custom
      );
    });
  });

  describe('isAudioNotificationSupported', () => {
    it('returns true on macOS', () => {
      sandbox.stub(process, 'platform').value('darwin');
      assert.isTrue(Settings.isAudioNotificationSupported());
    });

    it('returns false on Windows 7', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('7.0.0');
      assert.isFalse(Settings.isAudioNotificationSupported());
    });

    it('returns true on Windows 8', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('8.0.0');
      assert.isTrue(Settings.isAudioNotificationSupported());
    });

    it('returns true on Linux', () => {
      sandbox.stub(process, 'platform').value('linux');
      assert.isTrue(Settings.isAudioNotificationSupported());
    });
  });

  describe('isNotificationGroupingSupported', () => {
    it('returns true on macOS', () => {
      sandbox.stub(process, 'platform').value('darwin');
      assert.isTrue(Settings.isNotificationGroupingSupported());
    });

    it('returns true on Windows 7', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('7.0.0');
      assert.isFalse(Settings.isNotificationGroupingSupported());
    });

    it('returns true on Windows 8', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('8.0.0');
      assert.isTrue(Settings.isNotificationGroupingSupported());
    });

    it('returns true on Linux', () => {
      sandbox.stub(process, 'platform').value('linux');
      assert.isTrue(Settings.isNotificationGroupingSupported());
    });
  });

  describe('isAutoLaunchSupported', () => {
    it('returns true on Windows', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('8.0.0');
      assert.isTrue(Settings.isAutoLaunchSupported());
    });

    it('returns true on macOS', () => {
      sandbox.stub(process, 'platform').value('darwin');
      assert.isTrue(Settings.isAutoLaunchSupported());
    });

    it('returns false on Linux', () => {
      sandbox.stub(process, 'platform').value('linux');
      assert.isFalse(Settings.isAutoLaunchSupported());
    });
  });

  describe('isHideMenuBarSupported', () => {
    it('returns false on macOS', () => {
      sandbox.stub(process, 'platform').value('darwin');
      assert.isFalse(Settings.isHideMenuBarSupported());
    });

    it('returns true on Windows 7', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('7.0.0');
      assert.isTrue(Settings.isHideMenuBarSupported());
    });

    it('returns true on Windows 8', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('8.0.0');
      assert.isTrue(Settings.isHideMenuBarSupported());
    });

    it('returns true on Linux', () => {
      sandbox.stub(process, 'platform').value('linux');
      assert.isTrue(Settings.isHideMenuBarSupported());
    });
  });

  describe('isDrawAttentionSupported', () => {
    it('returns false on macOS', () => {
      sandbox.stub(process, 'platform').value('darwin');
      assert.isFalse(Settings.isDrawAttentionSupported());
    });

    it('returns true on Windows 7', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('7.0.0');
      assert.isTrue(Settings.isDrawAttentionSupported());
    });

    it('returns true on Windows 8', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('8.0.0');
      assert.isTrue(Settings.isDrawAttentionSupported());
    });

    it('returns true on Linux', () => {
      sandbox.stub(process, 'platform').value('linux');
      assert.isTrue(Settings.isDrawAttentionSupported());
    });
  });

  describe('isSystemTraySupported', () => {
    it('returns false on macOS', () => {
      sandbox.stub(process, 'platform').value('darwin');
      assert.isFalse(Settings.isSystemTraySupported('1.2.3'));
    });

    it('returns true on Windows 8', () => {
      sandbox.stub(process, 'platform').value('win32');
      sandbox.stub(os, 'release').returns('8.0.0');
      assert.isTrue(Settings.isSystemTraySupported('1.2.3'));
    });

    it('returns false on Linux production', () => {
      sandbox.stub(process, 'platform').value('linux');
      assert.isFalse(Settings.isSystemTraySupported('1.2.3'));
    });

    it('returns true on Linux beta', () => {
      sandbox.stub(process, 'platform').value('linux');
      assert.isTrue(Settings.isSystemTraySupported('1.2.3-beta.4'));
    });
  });
});
