// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber } from 'lodash';
import { unicodeNumber } from 'unicode-number';
import { getSegmenter } from './grapheme.std.ts';

const IS_ALL_DIGITS = /^\p{Nd}+$/u;
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export function normalizePin(pin: string): string {
  let result = pin.trim();

  if (IS_ALL_DIGITS.test(result)) {
    const segmenter = getSegmenter();
    const segments = segmenter.segment(result);

    let updated = '';
    for (const segment of segments) {
      const parsedValue = unicodeNumber(segment.segment);
      if (isNumber(parsedValue) && DIGITS.includes(parsedValue)) {
        updated += parsedValue.toString();
      } else {
        updated += segment.segment;
      }
    }

    result = updated;
  }

  return result.normalize('NFKD');
}
