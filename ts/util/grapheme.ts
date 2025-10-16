// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import memoizee from 'memoizee';

import { map, size, take, join } from './iterables.std.js';

const getSegmenter = memoizee((): Intl.Segmenter => new Intl.Segmenter());

export function getGraphemes(str: string): Iterable<string> {
  const segments = getSegmenter().segment(str);
  return map(segments, s => s.segment);
}

export function count(str: string): number {
  const segments = getSegmenter().segment(str);
  return size(segments);
}

/** @return truncated string and size (after any truncation) */
export function truncateAndSize(
  str: string,
  toSize?: number
): [string, number] {
  const segments = getSegmenter().segment(str);
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
  const segments = getSegmenter().segment(str);
  return segments.containing(0).segment === str;
}

export function hasAtMostGraphemes(str: string, max: number): boolean {
  if (max < 0) {
    return false;
  }

  let countSoFar = 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const _ of getSegmenter().segment(str)) {
    countSoFar += 1;
    if (countSoFar > max) {
      return false;
    }
  }

  return true;
}
