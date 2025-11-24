// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { HourCycleSettingType } from '../../util/preload.preload.js';

describe('HourCycleSettingType', () => {
  describe('valid setting values', () => {
    it('should accept "system" as a valid setting', () => {
      const setting: HourCycleSettingType = 'system';
      assert.equal(setting, 'system');
    });

    it('should accept "12" as a valid setting', () => {
      const setting: HourCycleSettingType = '12';
      assert.equal(setting, '12');
    });

    it('should accept "24" as a valid setting', () => {
      const setting: HourCycleSettingType = '24';
      assert.equal(setting, '24');
    });
  });
});
