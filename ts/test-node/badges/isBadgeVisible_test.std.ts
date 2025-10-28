// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { BadgeType } from '../../badges/types.std.js';

import { isBadgeVisible } from '../../badges/isBadgeVisible.std.js';
import { BadgeCategory } from '../../badges/BadgeCategory.std.js';

describe('isBadgeVisible', () => {
  const fakeBadge = (isVisible?: boolean): BadgeType => ({
    category: BadgeCategory.Donor,
    descriptionTemplate: 'test',
    id: 'TEST',
    images: [],
    name: 'test',
    ...(typeof isVisible === 'boolean' ? { expiresAt: 123, isVisible } : {}),
  });

  it("returns true if the visibility is unspecified (someone else's badge)", () => {
    assert.isTrue(isBadgeVisible(fakeBadge()));
  });

  it('returns false if not visible', () => {
    assert.isFalse(isBadgeVisible(fakeBadge(false)));
  });

  it('returns true if visible', () => {
    assert.isTrue(isBadgeVisible(fakeBadge(true)));
  });
});
