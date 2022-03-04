// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { clamp } from 'lodash';
import { isSorted } from './isSorted';
import { strictAssert } from './assert';

export const MIN_WIDTH = 97;
export const SNAP_WIDTH = 200;
export const MIN_FULL_WIDTH = 280;
export const MAX_WIDTH = 380;
strictAssert(
  isSorted([MIN_WIDTH, SNAP_WIDTH, MIN_FULL_WIDTH, MAX_WIDTH]),
  'Expected widths to be in the right order'
);

export function getWidthFromPreferredWidth(
  preferredWidth: number,
  { requiresFullWidth }: { requiresFullWidth: boolean }
): number {
  const clampedWidth = clamp(preferredWidth, MIN_WIDTH, MAX_WIDTH);

  if (requiresFullWidth || clampedWidth >= SNAP_WIDTH) {
    return Math.max(clampedWidth, MIN_FULL_WIDTH);
  }

  return MIN_WIDTH;
}
