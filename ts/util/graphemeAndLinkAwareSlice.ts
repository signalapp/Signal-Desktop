// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import LinkifyIt from 'linkify-it';

export function graphemeAndLinkAwareSlice(
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
      text = expandToIncludeEntireLink(str, text);

      return {
        text,
        hasReadMore: text.length < str.length,
      };
    }
  }

  return {
    text: str,
    hasReadMore: false,
  };
}

const expandToIncludeEntireLink = (
  original: string,
  truncated: string
): string => {
  const linksInText = new LinkifyIt().match(original);

  if (!linksInText) {
    return truncated;
  }

  const invalidTruncationRanges: Array<LinkRange> = linksInText.map(
    ({ index: startIndex, lastIndex }) => ({ startIndex, lastIndex })
  );

  const truncatedLink: Array<LinkRange> = invalidTruncationRanges.filter(
    ({ startIndex, lastIndex }) =>
      startIndex < truncated.length && lastIndex > truncated.length
  );

  if (truncatedLink.length === 0) {
    return truncated;
  }

  return original.slice(0, truncatedLink[0].lastIndex);
};

type LinkRange = {
  startIndex: number;
  lastIndex: number;
};
