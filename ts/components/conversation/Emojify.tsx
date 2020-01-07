import React from 'react';

import classNames from 'classnames';

import emojiRegex from 'emoji-regex';

import { RenderTextCallbackType } from '../../types/Util';
import { emojiToImage, SizeClassType } from '../emoji/lib';

// Some of this logic taken from emoji-js/replacement
function getImageTag({
  match,
  sizeClass,
  key,
}: {
  match: any;
  sizeClass?: SizeClassType;
  key: string | number;
}) {
  const img = emojiToImage(match[0]);

  if (!img) {
    return match[0];
  }

  return (
    // tslint:disable-next-line react-a11y-img-has-alt
    <img
      key={key}
      src={img}
      aria-label={match[0]}
      className={classNames('emoji', sizeClass)}
      title={match[0]}
    />
  );
}

interface Props {
  text: string;
  /** A class name to be added to the generated emoji images */
  sizeClass?: SizeClassType;
  /** Allows you to customize now non-newlines are rendered. Simplest is just a <span>. */
  renderNonEmoji?: RenderTextCallbackType;
}

export class Emojify extends React.Component<Props> {
  public static defaultProps: Partial<Props> = {
    renderNonEmoji: ({ text }) => text,
  };

  public render() {
    const { text, sizeClass, renderNonEmoji } = this.props;
    const results: Array<any> = [];
    const regex = emojiRegex();

    // We have to do this, because renderNonEmoji is not required in our Props object,
    //  but it is always provided via defaultProps.
    if (!renderNonEmoji) {
      return;
    }

    let match = regex.exec(text);
    let last = 0;
    let count = 1;

    if (!match) {
      return renderNonEmoji({ text, key: 0 });
    }

    while (match) {
      if (last < match.index) {
        const textWithNoEmoji = text.slice(last, match.index);
        results.push(renderNonEmoji({ text: textWithNoEmoji, key: count++ }));
      }

      results.push(getImageTag({ match, sizeClass, key: count++ }));

      last = regex.lastIndex;
      match = regex.exec(text);
    }

    if (last < text.length) {
      results.push(renderNonEmoji({ text: text.slice(last), key: count++ }));
    }

    return results;
  }
}
