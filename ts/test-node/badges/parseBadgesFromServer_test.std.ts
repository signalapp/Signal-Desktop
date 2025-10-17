// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import lodash from 'lodash';
import { BadgeCategory } from '../../badges/BadgeCategory.std.js';
import { BadgeImageTheme } from '../../badges/BadgeImageTheme.std.js';

import { parseBadgesFromServer } from '../../badges/parseBadgesFromServer.std.js';

const { omit } = lodash;

describe('parseBadgesFromServer', () => {
  const UPDATES_URL = 'https://updates2.signal.org/desktop';

  const validBadgeData = {
    id: 'fake-badge-id',
    category: 'donor',
    name: 'Cool Donor',
    description: 'Hello {short_name}',
    svg: 'huge badge.svg',
    svgs: ['small', 'medium', 'large'].map(size => ({
      dark: `${size} badge dark.svg`,
      light: `${size} badge light.svg`,
    })),
  };
  const validBadge = {
    id: validBadgeData.id,
    category: BadgeCategory.Donor,
    name: 'Cool Donor',
    descriptionTemplate: 'Hello {short_name}',
    images: [
      ...['small', 'medium', 'large'].map(size => ({
        [BadgeImageTheme.Dark]: {
          url: `https://updates2.signal.org/static/badges/${size}%20badge%20dark.svg`,
        },
        [BadgeImageTheme.Light]: {
          url: `https://updates2.signal.org/static/badges/${size}%20badge%20light.svg`,
        },
      })),
      {
        [BadgeImageTheme.Transparent]: {
          url: 'https://updates2.signal.org/static/badges/huge%20badge.svg',
        },
      },
    ],
  };

  it('returns an empty array if passed a non-array', () => {
    [undefined, null, 'foo.svg', validBadgeData].forEach(input => {
      assert.isEmpty(parseBadgesFromServer(input, UPDATES_URL));
    });
  });

  it('returns an empty array if passed one', () => {
    assert.isEmpty(parseBadgesFromServer([], UPDATES_URL));
  });

  it('parses valid badge data', () => {
    const input = [validBadgeData];
    assert.deepStrictEqual(parseBadgesFromServer(input, UPDATES_URL), [
      validBadge,
    ]);
  });

  it('only returns the first 1000 badges', () => {
    const input = Array(1234).fill(validBadgeData);
    assert.lengthOf(parseBadgesFromServer(input, UPDATES_URL), 1000);
  });

  it('discards badges with invalid IDs', () => {
    [undefined, null, 123].forEach(id => {
      const invalidBadgeData = {
        ...validBadgeData,
        name: 'Should be missing',
        id,
      };
      const input = [validBadgeData, invalidBadgeData];
      assert.deepStrictEqual(parseBadgesFromServer(input, UPDATES_URL), [
        validBadge,
      ]);
    });
  });

  it('discards badges with invalid names', () => {
    [undefined, null, 123].forEach(name => {
      const invalidBadgeData = {
        ...validBadgeData,
        description: 'Should be missing',
        name,
      };
      const input = [validBadgeData, invalidBadgeData];
      assert.deepStrictEqual(parseBadgesFromServer(input, UPDATES_URL), [
        validBadge,
      ]);
    });
  });

  it('discards badges with invalid description templates', () => {
    [undefined, null, 123].forEach(description => {
      const invalidBadgeData = {
        ...validBadgeData,
        name: 'Hello',
        description,
      };
      const input = [validBadgeData, invalidBadgeData];
      assert.deepStrictEqual(parseBadgesFromServer(input, UPDATES_URL), [
        validBadge,
      ]);
    });
  });

  it('discards badges that lack a valid "huge" SVG', () => {
    const input = [
      validBadgeData,
      omit(validBadgeData, 'svg'),
      { ...validBadgeData, svg: 123 },
    ];
    assert.deepStrictEqual(parseBadgesFromServer(input, UPDATES_URL), [
      validBadge,
    ]);
  });

  it('discards badges that lack exactly 3 valid "normal" SVGs', () => {
    const input = [
      validBadgeData,
      omit(validBadgeData, 'svgs'),
      { ...validBadgeData, svgs: 'bad!' },
      { ...validBadgeData, svgs: [] },
      {
        ...validBadgeData,
        svgs: validBadgeData.svgs.slice(0, 2),
      },
      {
        ...validBadgeData,
        svgs: [{}, ...validBadgeData.svgs.slice(1)],
      },
      {
        ...validBadgeData,
        svgs: [{ dark: 123 }, ...validBadgeData.svgs.slice(1)],
      },
      {
        ...validBadgeData,
        svgs: [
          ...validBadgeData.svgs,
          {
            dark: 'too.svg',
            light: 'many.svg',
          },
        ],
      },
    ];
    assert.deepStrictEqual(parseBadgesFromServer(input, UPDATES_URL), [
      validBadge,
    ]);
  });

  it('converts "donor" to the Donor category', () => {
    const input = [validBadgeData];
    assert.strictEqual(
      parseBadgesFromServer(input, UPDATES_URL)[0]?.category,
      BadgeCategory.Donor
    );
  });

  it('converts "other" to the Other category', () => {
    const input = [
      {
        ...validBadgeData,
        category: 'other',
      },
    ];
    assert.strictEqual(
      parseBadgesFromServer(input, UPDATES_URL)[0]?.category,
      BadgeCategory.Other
    );
  });

  it('converts unexpected categories to Other', () => {
    const input = [
      {
        ...validBadgeData,
        category: 'garbage',
      },
    ];
    assert.strictEqual(
      parseBadgesFromServer(input, UPDATES_URL)[0]?.category,
      BadgeCategory.Other
    );
  });

  it('parses your own badges', () => {
    const input = [
      {
        ...validBadgeData,
        expiration: 1234,
        visible: true,
      },
    ];

    const badge = parseBadgesFromServer(input, UPDATES_URL)[0];
    if (!badge || !('expiresAt' in badge) || !('isVisible' in badge)) {
      throw new Error('Badge is invalid');
    }

    assert.strictEqual(badge.expiresAt, 1234 * 1000);
    assert.isTrue(badge.isVisible);
  });
});
