// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { HourCyclePreference } from '../../types/I18N.std.js';

describe('HourCyclePreference', () => {
  describe('enum values', () => {
    it('should have Prefer24 value', () => {
      assert.equal(HourCyclePreference.Prefer24, 'Prefer24');
    });

    it('should have Prefer12 value', () => {
      assert.equal(HourCyclePreference.Prefer12, 'Prefer12');
    });

    it('should have UnknownPreference value', () => {
      assert.equal(HourCyclePreference.UnknownPreference, 'UnknownPreference');
    });

    it('should only contain three values', () => {
      const values = Object.values(HourCyclePreference);
      assert.lengthOf(values, 3);
      assert.include(values, HourCyclePreference.Prefer24);
      assert.include(values, HourCyclePreference.Prefer12);
      assert.include(values, HourCyclePreference.UnknownPreference);
    });
  });
});
