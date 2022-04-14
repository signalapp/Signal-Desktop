// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function graphemeAwareSlice(
  str: string,
  length: number,
  buffer = 100
): {
  hasReadMore: boolean;
  text: string;
} {
  if (str.length <= length + buffer) {
    return { text: str, hasReadMore: false };
  }

  let text: string | undefined;

  for (const { index } of new Intl.Segmenter().segment(str)) {
    if (!text && index >= length) {
      text = str.slice(0, index);
    }
    if (text && index > length) {
      return {
        text,
        hasReadMore: true,
      };
    }
  }

  return {
    text: str,
    hasReadMore: false,
  };
}
