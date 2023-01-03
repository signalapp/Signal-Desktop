// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { map, size, take, join } from './iterables';

export function getGraphemes(str: string): Iterable<string> {
  const segments = new Intl.Segmenter().segment(str);
  return map(segments, s => s.segment);
}

export function count(str: string): number {
  const segments = new Intl.Segmenter().segment(str);
  return size(segments);
}

/** @return truncated string and size (after any truncation) */
export function truncateAndSize(
  str: string,
  toSize?: number
): [string, number] {
  const segments = new Intl.Segmenter().segment(str);
  const originalSize = size(segments);
  if (toSize === undefined || originalSize <= toSize) {
    return [str, originalSize];
  }
  return [
    join(
      map(take(segments, toSize), s => s.segment),
      ''
    ),
    toSize,
  ];
}

export function isSingleGrapheme(str: string): boolean {
  if (str === '') {
    return false;
  }
  const segments = new Intl.Segmenter().segment(str);
  return segments.containing(0).segment === str;
}
