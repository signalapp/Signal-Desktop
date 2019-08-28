import React from 'react';

import LinkifyIt from 'linkify-it';

import { RenderTextCallbackType } from '../../types/Util';
import { isLinkSneaky } from '../../../js/modules/link_previews';

const linkify = LinkifyIt();

interface Props {
  text: string;
  isRss?: boolean;
  /** Allows you to customize now non-links are rendered. Simplest is just a <span>. */
  renderNonLink?: RenderTextCallbackType;
}

const SUPPORTED_PROTOCOLS = /^(http|https):/i;
const HAS_AT = /@/;

export class Linkify extends React.Component<Props> {
  public static defaultProps: Partial<Props> = {
    renderNonLink: ({ text }) => text,
  };

  public render() {
    const { text, renderNonLink, isRss } = this.props;
    const results: Array<any> = [];

    if (isRss && text.indexOf('</') !== -1) {
      results.push(
        <div
          dangerouslySetInnerHTML={{
            __html: text
              .replace(
                /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                ''
              )
              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ''),
          }}
        />
      );
      // should already have links

      return results;
    }

    const matchData = linkify.match(text) || [];
    let last = 0;
    let count = 1;

    // We have to do this, because renderNonLink is not required in our Props object,
    //  but it is always provided via defaultProps.
    if (!renderNonLink) {
      return;
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
          results.push(renderNonLink({ text: textWithNoLink, key: count++ }));
        }

        const { url, text: originalText } = match;
        if (
          SUPPORTED_PROTOCOLS.test(url) &&
          !isLinkSneaky(url) &&
          !HAS_AT.test(url)
        ) {
          results.push(
            <a key={count++} href={url}>
              {originalText}
            </a>
          );
        } else {
          results.push(renderNonLink({ text: originalText, key: count++ }));
        }

        last = match.lastIndex;
      }
    );

    if (last < text.length) {
      results.push(renderNonLink({ text: text.slice(last), key: count++ }));
    }

    return results;
  }
}
