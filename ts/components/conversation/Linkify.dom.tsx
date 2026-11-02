// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import {
  linkify,
  SUPPORTED_PROTOCOLS,
  type LinkifyItMatch,
} from '../../util/linkify.std.ts';

import type { RenderTextCallbackType } from '../../types/Util.std.ts';
import {
  isLinkSneaky,
  shouldLinkifyMessage,
} from '../../types/LinkPreview.std.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { Emoji } from '../../axo/emoji.std.ts';

export { linkify, SUPPORTED_PROTOCOLS };

export type Props = {
  text: string;
  /** Allows you to customize how non-links are rendered. Simplest is just a <span>. */
  renderNonLink?: RenderTextCallbackType;
};

const defaultRenderNonLink: RenderTextCallbackType = ({ text }) => text;

type ChunkDataItem = Readonly<{
  chunk: string;
  matchData: ReadonlyArray<LinkifyItMatch>;
}>;

export function Linkify(props: Props): JSX.Element {
  const { text, renderNonLink = defaultRenderNonLink } = props;

  if (!shouldLinkifyMessage(text)) {
    return <>{renderNonLink({ text, key: 1 })}</>;
  }

  const segments = Array.from(Emoji.getSegments(text));

  const chunkData = segments.map((segment): ChunkDataItem => {
    const chunk = segment.value;

    if (segment.kind === 'text') {
      return { chunk, matchData: linkify.match(chunk) || [] };
    }

    if (segment.kind === 'emoji') {
      return { chunk, matchData: [] };
    }

    throw missingCaseError(segment);
  });

  const results: Array<JSX.Element | string> = [];
  let count = 1;

  chunkData.forEach(({ chunk, matchData }) => {
    if (matchData.length === 0) {
      count += 1;
      results.push(renderNonLink({ text: chunk, key: count }));
      return;
    }

    let chunkLastIndex = 0;
    matchData.forEach(match => {
      if (chunkLastIndex < match.index) {
        const textWithNoLink = chunk.slice(chunkLastIndex, match.index);
        count += 1;
        results.push(renderNonLink({ text: textWithNoLink, key: count }));
      }

      const { url, text: originalText } = match;
      count += 1;
      if (SUPPORTED_PROTOCOLS.test(url) && isLinkSneaky(url) !== 'yes') {
        results.push(
          <a key={count} href={url}>
            {originalText}
          </a>
        );
      } else {
        results.push(renderNonLink({ text: originalText, key: count }));
      }

      chunkLastIndex = match.lastIndex;
    });

    if (chunkLastIndex < chunk.length) {
      count += 1;
      results.push(
        renderNonLink({
          text: chunk.slice(chunkLastIndex),
          key: count,
        })
      );
    }
  });

  return <>{results}</>;
}
