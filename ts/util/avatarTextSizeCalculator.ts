// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getEmojiCount } from '../components/emoji/lib';
import { isEmojiOnlyText } from './isEmojiOnlyText';

type FontSizes = {
  diameter: number;
  singleEmoji: number;
  smol: number;
  text: number;
};

type RectSize = {
  height: number;
  width: number;
};

export function getFontSizes(bubbleSize: number): FontSizes {
  return {
    diameter: Math.ceil(bubbleSize * 0.75),
    singleEmoji: Math.ceil(bubbleSize * 0.6),
    smol: Math.ceil(bubbleSize * 0.05),
    text: Math.ceil(bubbleSize * 0.45),
  };
}

export function getFittedFontSize(
  bubbleSize: number,
  text: string,
  measure: (candidateFontSize: number) => RectSize
): number {
  const sizes = getFontSizes(bubbleSize);

  let candidateFontSize = sizes.text;
  if (isEmojiOnlyText(text) && getEmojiCount(text) === 1) {
    candidateFontSize = sizes.singleEmoji;
  }

  for (
    candidateFontSize;
    candidateFontSize >= sizes.smol;
    candidateFontSize -= 1
  ) {
    const { height, width } = measure(candidateFontSize);
    if (width < sizes.diameter && height < sizes.diameter) {
      return candidateFontSize;
    }
  }

  return candidateFontSize;
}
