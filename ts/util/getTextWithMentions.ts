// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { BodyRangesType } from '../types/Util';

export function getTextWithMentions(
  bodyRanges: BodyRangesType,
  text: string
): string {
  return bodyRanges.reduce((str, range) => {
    const textBegin = str.substr(0, range.start);
    const textEnd = str.substr(range.start + range.length, str.length);
    return `${textBegin}@${range.replacementText}${textEnd}`;
  }, text);
}
