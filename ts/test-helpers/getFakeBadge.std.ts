// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import type { BadgeType } from '../badges/types.std.js';
import { BadgeCategory } from '../badges/BadgeCategory.std.js';
import { BadgeImageTheme } from '../badges/BadgeImageTheme.std.js';
import { repeat, zipObject } from '../util/iterables.std.js';

const { times } = lodash;

export function getFakeBadge({
  alternate = false,
  id = 'test-badge',
}: Readonly<{
  alternate?: boolean;
  id?: string;
}> = {}): BadgeType {
  const imageFile = {
    localPath: `/fixtures/${alternate ? 'blue' : 'orange'}-heart.svg`,
    url: 'https://example.com/ignored.svg',
  };

  return {
    id,
    category: alternate ? BadgeCategory.Other : BadgeCategory.Donor,
    name: `Test Badge ${alternate ? 'B' : 'A'}`,
    descriptionTemplate:
      "{short_name} got this badge because they're cool. Signal is a nonprofit with no advertisers or investors, supported only by people like you.",
    images: [
      ...Array(3).fill(
        zipObject(Object.values(BadgeImageTheme), repeat(imageFile))
      ),
      { [BadgeImageTheme.Transparent]: imageFile },
    ],
  };
}

export const getFakeBadges = (count: number): Array<BadgeType> =>
  times(count, index =>
    getFakeBadge({
      alternate: index % 2 !== 0,
      id: `test-badge-${index}`,
    })
  );
