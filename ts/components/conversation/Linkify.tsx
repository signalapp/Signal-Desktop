// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import LinkifyIt from 'linkify-it';

import { RenderTextCallbackType } from '../../types/Util';
import { isLinkSneaky } from '../../types/LinkPreview';
import { splitByEmoji } from '../../util/emoji';
import { missingCaseError } from '../../util/missingCaseError';

const linkify = LinkifyIt()
  // This is all of the TLDs in place in 2010, according to [Wikipedia][0]. Note that
  //   this only applies to "fuzzy" matches (`example.com`), not matches with
  //   protocols (`https://example.com`).
  // [0]: https://en.wikipedia.org/wiki/Generic_top-level_domain#History
  .tlds([
    'aero',
    'asia',
    'biz',
    'cat',
    'com',
    'coop',
    'edu',
    'gov',
    'info',
    'int',
    'jobs',
    'mil',
    'mobi',
    'museum',
    'name',
    'net',
    'org',
    'pro',
    'tel',
    'travel',
  ]);

export type Props = {
  text: string;
  /** Allows you to customize how non-links are rendered. Simplest is just a <span>. */
  renderNonLink?: RenderTextCallbackType;
};

const SUPPORTED_PROTOCOLS = /^(http|https):/i;

export class Linkify extends React.Component<Props> {
  public static defaultProps: Partial<Props> = {
    renderNonLink: ({ text }) => text,
  };

  public render():
    | JSX.Element
    | string
    | null
    | Array<JSX.Element | string | null> {
    const { text, renderNonLink } = this.props;

    // We have to do this, because renderNonLink is not required in our Props object,
    //  but it is always provided via defaultProps.
    if (!renderNonLink) {
      return null;
    }

    const chunkData: Array<{
      chunk: string;
      matchData: ReadonlyArray<LinkifyIt.Match>;
    }> = splitByEmoji(text).map(({ type, value: chunk }) => {
      if (type === 'text') {
        return { chunk, matchData: linkify.match(chunk) || [] };
      }

      if (type === 'emoji') {
        return { chunk, matchData: [] };
      }

      throw missingCaseError(type);
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
        if (SUPPORTED_PROTOCOLS.test(url) && !isLinkSneaky(url)) {
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

    return results;
  }
}
