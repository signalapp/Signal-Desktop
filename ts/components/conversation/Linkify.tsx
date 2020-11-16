// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import LinkifyIt from 'linkify-it';

import { RenderTextCallbackType } from '../../types/Util';
import { isLinkSneaky } from '../../../js/modules/link_previews';

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

export interface Props {
  text: string;
  /** Allows you to customize now non-links are rendered. Simplest is just a <span>. */
  renderNonLink?: RenderTextCallbackType;
}

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
    const matchData = linkify.match(text) || [];
    const results: Array<JSX.Element | string> = [];
    let last = 0;
    let count = 1;

    // We have to do this, because renderNonLink is not required in our Props object,
    //  but it is always provided via defaultProps.
    if (!renderNonLink) {
      return null;
    }

    if (matchData.length === 0) {
      return renderNonLink({ text, key: 0 });
    }

    matchData.forEach(
      (match: {
        index: number;
        url: string;
        lastIndex: number;
        text: string;
      }) => {
        if (last < match.index) {
          const textWithNoLink = text.slice(last, match.index);
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

        last = match.lastIndex;
      }
    );

    if (last < text.length) {
      count += 1;
      results.push(renderNonLink({ text: text.slice(last), key: count }));
    }

    return results;
  }
}
