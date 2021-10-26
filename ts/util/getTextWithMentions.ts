// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { BodyRangesType } from '../types/Util';

export function getTextWithMentions(
  bodyRanges: BodyRangesType,
  text: string
): string {
  return bodyRanges
    .sort((a, b) => b.start - a.start)
    .reduce((acc, { start, length, replacementText }) => {
      const left = acc.slice(0, start);
      const right = acc.slice(start + length);
      return `${left}@${replacementText}${right}`;
    }, text);
}
