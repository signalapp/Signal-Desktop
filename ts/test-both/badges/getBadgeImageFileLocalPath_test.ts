// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { BadgeCategory } from '../../badges/BadgeCategory';
import { BadgeImageTheme } from '../../badges/BadgeImageTheme';

import { getBadgeImageFileLocalPath } from '../../badges/getBadgeImageFileLocalPath';

describe('getBadgeImageFileLocalPath', () => {
  const image = (localPath?: string) => ({
    localPath,
    url: 'https://example.com/ignored.svg',
  });

  const badge = {
    category: BadgeCategory.Donor,
    descriptionTemplate: 'foo bar',
    id: 'foo',
    images: ['small', 'medium', 'large', 'huge'].map(size => ({
      [BadgeImageTheme.Dark]: image(`/${size}-dark.svg`),
      [BadgeImageTheme.Light]: image(undefined),
      [BadgeImageTheme.Transparent]: image(`/${size}-trns.svg`),
    })),
    name: 'Test Badge',
  };

  it('returns undefined if passed no badge', () => {
    const result = getBadgeImageFileLocalPath(
      undefined,
      123,
      BadgeImageTheme.Transparent
    );
    assert.isUndefined(result);
  });

  it('returns the first image if passed a small size', () => {
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

    const transparentResult = getBadgeImageFileLocalPath(
      badge,
      12,
      BadgeImageTheme.Transparent
    );
    assert.strictEqual(transparentResult, '/small-trns.svg');
  });

  it('returns the second image if passed a size between 24 and 36', () => {
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

    const transparentResult = getBadgeImageFileLocalPath(
      badge,
      35,
      BadgeImageTheme.Transparent
    );
    assert.strictEqual(transparentResult, '/medium-trns.svg');
  });

  it('returns the third image if passed a size between 36 and 160', () => {
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

    const transparentResult = getBadgeImageFileLocalPath(
      badge,
      159,
      BadgeImageTheme.Transparent
    );
    assert.strictEqual(transparentResult, '/large-trns.svg');
  });

  it('returns the last image if passed a size above 159', () => {
    const darkResult = getBadgeImageFileLocalPath(
      badge,
      160,
      BadgeImageTheme.Dark
    );
    assert.strictEqual(darkResult, '/huge-dark.svg');

    const lightResult = getBadgeImageFileLocalPath(
      badge,
      200,
      BadgeImageTheme.Light
    );
    assert.isUndefined(lightResult);

    const transparentResult = getBadgeImageFileLocalPath(
      badge,
      999,
      BadgeImageTheme.Transparent
    );
    assert.strictEqual(transparentResult, '/huge-trns.svg');
  });
});
