// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { BadgeCategory } from '../../badges/BadgeCategory.std.js';
import { BadgeImageTheme } from '../../badges/BadgeImageTheme.std.js';

import { getBadgeImageFileLocalPath } from '../../badges/getBadgeImageFileLocalPath.std.js';

describe('getBadgeImageFileLocalPath', () => {
  const image = (localPath?: string) => ({
    localPath,
    url: 'https://example.com/ignored.svg',
  });

  const badge = {
    category: BadgeCategory.Donor,
    descriptionTemplate: 'foo bar',
    id: 'foo',
    images: [
      ...['small', 'medium', 'large'].map(size => ({
        [BadgeImageTheme.Dark]: image(`/${size}-dark.svg`),
        [BadgeImageTheme.Light]: image(undefined),
      })),
      { [BadgeImageTheme.Transparent]: image('/huge-trns.svg') },
    ],
    name: 'Test Badge',
  };

  it('returns undefined if passed no badge', () => {
    assert.isUndefined(
      getBadgeImageFileLocalPath(undefined, 123, BadgeImageTheme.Dark)
    );
    assert.isUndefined(
      getBadgeImageFileLocalPath(undefined, 123, BadgeImageTheme.Transparent)
    );
  });

  describe('dark/light themes', () => {
    it('returns the first matching image if passed a small size', () => {
      const darkResult = getBadgeImageFileLocalPath(
        badge,
        10,
        BadgeImageTheme.Dark
      );
      assert.strictEqual(darkResult, '/small-dark.svg');

      const lightResult = getBadgeImageFileLocalPath(
        badge,
        11,
        BadgeImageTheme.Light
      );
      assert.isUndefined(lightResult);
    });

    it('returns the second matching image if passed a size between 24 and 36', () => {
      const darkResult = getBadgeImageFileLocalPath(
        badge,
        24,
        BadgeImageTheme.Dark
      );
      assert.strictEqual(darkResult, '/medium-dark.svg');

      const lightResult = getBadgeImageFileLocalPath(
        badge,
        30,
        BadgeImageTheme.Light
      );
      assert.isUndefined(lightResult);
    });

    it('returns the third matching image if passed a size between 36 and 160', () => {
      const darkResult = getBadgeImageFileLocalPath(
        badge,
        36,
        BadgeImageTheme.Dark
      );
      assert.strictEqual(darkResult, '/large-dark.svg');

      const lightResult = getBadgeImageFileLocalPath(
        badge,
        100,
        BadgeImageTheme.Light
      );
      assert.isUndefined(lightResult);
    });

    it('returns the last matching image if passed a size above 159', () => {
      const darkResult = getBadgeImageFileLocalPath(
        badge,
        160,
        BadgeImageTheme.Dark
      );
      assert.strictEqual(darkResult, '/large-dark.svg');

      const lightResult = getBadgeImageFileLocalPath(
        badge,
        200,
        BadgeImageTheme.Light
      );
      assert.isUndefined(lightResult);
    });
  });

  describe('transparent themes', () => {
    it('returns the transparent image, no matter the size', () => {
      [1, 12, 28, 50, 200, 999].forEach(size => {
        const transparentResult = getBadgeImageFileLocalPath(
          badge,
          size,
          BadgeImageTheme.Transparent
        );
        assert.strictEqual(transparentResult, '/huge-trns.svg');
      });
    });
  });
});
