import React from 'react';

import createLinkify from 'linkify-it';

import { Emojify, getSizeClass } from './Emojify';

const linkify = createLinkify();

interface Props {
  text: string;
  disableJumbomoji?: boolean;
  disableLinks?: boolean;
}

const SUPPORTED_PROTOCOLS = /^(http|https):/i;

export class MessageBody extends React.Component<Props, {}> {
  public render() {
    const { text, disableJumbomoji, disableLinks } = this.props;
    const matchData = linkify.match(text) || [];
    const results: Array<any> = [];
    let last = 0;
    let count = 1;

    // We only use this sizeClass if there was no link detected, because jumbo emoji
    //   only fire when there's no other text in the message.
    const sizeClass = disableJumbomoji ? '' : getSizeClass(text);

    if (disableLinks || matchData.length === 0) {
      return <Emojify text={text} sizeClass={sizeClass} />;
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
          results.push(<Emojify key={count++} text={textWithNoLink} />);
        }

        const { url, text: originalText } = match;
        if (SUPPORTED_PROTOCOLS.test(url)) {
          results.push(
            <a key={count++} href={url}>
              {originalText}
            </a>
          );
        } else {
          results.push(<Emojify key={count++} text={originalText} />);
        }

        last = match.lastIndex;
      }
    );

    if (last < text.length) {
      results.push(<Emojify key={count++} text={text.slice(last)} />);
    }

    return <span>{results}</span>;
  }
}
