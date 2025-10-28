// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  SystemTraySetting,
  parseSystemTraySetting,
  shouldMinimizeToSystemTray,
} from '../../types/SystemTraySetting.std.js';

describe('system tray setting utilities', () => {
  describe('shouldMinimizeToSystemTray', () => {
    it('returns false if the system tray is disabled', () => {
      assert.isFalse(
        shouldMinimizeToSystemTray(SystemTraySetting.DoNotUseSystemTray)
      );
    });

    it('returns true if the system tray is enabled', () => {
      assert.isTrue(
        shouldMinimizeToSystemTray(SystemTraySetting.MinimizeToSystemTray)
      );
      assert.isTrue(
        shouldMinimizeToSystemTray(
          SystemTraySetting.MinimizeToAndStartInSystemTray
        )
      );
    });
  });

  describe('parseSystemTraySetting', () => {
    it('parses valid strings into their enum values', () => {
      assert.strictEqual(
        parseSystemTraySetting('DoNotUseSystemTray'),
        SystemTraySetting.DoNotUseSystemTray
      );
      assert.strictEqual(
        parseSystemTraySetting('MinimizeToSystemTray'),
        SystemTraySetting.MinimizeToSystemTray
      );
      assert.strictEqual(
        parseSystemTraySetting('MinimizeToAndStartInSystemTray'),
        SystemTraySetting.MinimizeToAndStartInSystemTray
      );
    });

    it('parses invalid strings to Uninitialized', () => {
      assert.strictEqual(
        parseSystemTraySetting('garbage'),
        SystemTraySetting.Uninitialized
      );
    });
  });
});
