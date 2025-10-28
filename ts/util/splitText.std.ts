// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type SplitTextOptionsType = Readonly<{
  granularity: 'grapheme' | 'word';
  shouldBreak: (slice: string) => boolean;
}>;

export function splitText(
  text: string,
  { granularity, shouldBreak }: SplitTextOptionsType
): Array<string> {
  const isWordBased = granularity === 'word';
  const segmenter = new Intl.Segmenter(undefined, {
    granularity,
  });

  const result = new Array<string>();

  // Compute number of lines and height of text
  let acc = '';
  let best = '';
  for (const { segment, isWordLike } of segmenter.segment(text)) {
    acc += segment;

    // For "grapheme" segmenting, "isWordLike" is always "undefined"
    if (isWordLike === false) {
      best = acc;
      continue;
    }

    if (shouldBreak(isWordBased ? acc.trim() : acc)) {
      result.push(best);
      acc = acc.slice(best.length);
      best = acc;
    } else {
      best = acc;
    }
  }

  if (best) {
    result.push(best);
  }

  return isWordBased ? result.map(x => x.trim()) : result;
}
