// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import type { BadgeType } from './types.std.js';
import { BadgeImageTheme } from './BadgeImageTheme.std.js';

const { find, findLast, first, last } = lodash;

export function getBadgeImageFileLocalPath(
  badge: Readonly<undefined | BadgeType>,
  size: number,
  theme: BadgeImageTheme
): undefined | string {
  if (!badge) {
    return undefined;
  }

  const localPathsForTheme: Array<undefined | string> = badge.images.map(
    image => image[theme]?.localPath
  );

  if (theme === BadgeImageTheme.Transparent) {
    const search = size < 36 ? find : findLast;
    return search(localPathsForTheme, Boolean);
  }

  if (size < 24) {
    return first(localPathsForTheme);
  }
  if (size < 36) {
    return localPathsForTheme[1];
  }
  if (size < 160) {
    return localPathsForTheme[2];
  }
  return last(localPathsForTheme) || localPathsForTheme[2];
}
