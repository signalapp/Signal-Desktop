// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { first, last } from 'lodash';
import type { BadgeType, BadgeImageType } from './types';
import type { BadgeImageTheme } from './BadgeImageTheme';

export function getBadgeImageFileLocalPath(
  badge: Readonly<undefined | BadgeType>,
  size: number,
  theme: BadgeImageTheme
): undefined | string {
  if (!badge) {
    return undefined;
  }

  const { images } = badge;

  // We expect this to be defined for valid input, but defend against unexpected array
  //   lengths.
  let idealImage: undefined | BadgeImageType;
  if (size < 24) {
    idealImage = first(images);
  } else if (size < 36) {
    idealImage = images[1] || first(images);
  } else if (size < 160) {
    idealImage = images[2] || first(images);
  } else {
    idealImage = last(images);
  }

  return idealImage?.[theme]?.localPath;
}
