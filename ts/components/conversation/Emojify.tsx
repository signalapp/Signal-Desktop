import React from 'react';

import classNames from 'classnames';
import is from '@sindresorhus/is';

import {
  findImage,
  getRegex,
  getReplacementData,
  getTitle,
} from '../../util/emoji';

import { Localizer, RenderTextCallback } from '../../types/Util';

// Some of this logic taken from emoji-js/replacement
function getImageTag({
  match,
  sizeClass,
  key,
  i18n,
}: {
  match: any;
  sizeClass: string | undefined;
  key: string | number;
  i18n: Localizer;
}) {
  const result = getReplacementData(match[0], match[1], match[2]);

  if (is.string(result)) {
    return <span key={key}>{match[0]}</span>;
  }

  const img = findImage(result.value, result.variation);
  const title = getTitle(result.value);

  return (
    <img
      key={key}
      src={img.path}
      alt={i18n('emojiAlt', [title || ''])}
      className={classNames('emoji', sizeClass)}
      data-codepoints={img.full_idx}
      title={`:${title}:`}
    />
  );
}

interface Props {
  text: string;
  /** A class name to be added to the generated emoji images */
  sizeClass?: '' | 'small' | 'medium' | 'large' | 'jumbo';
  /** Allows you to customize now non-newlines are rendered. Simplest is just a <span>. */
  renderNonEmoji?: RenderTextCallback;
  i18n: Localizer;
}

export class Emojify extends React.Component<Props> {
  public static defaultProps: Partial<Props> = {
    renderNonEmoji: ({ text, key }) => <span key={key}>{text}</span>,
  };

  public render() {
    const { text, sizeClass, renderNonEmoji, i18n } = this.props;
    const results: Array<any> = [];
    const regex = getRegex();

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

      results.push(getImageTag({ match, sizeClass, key: count++, i18n }));

      last = regex.lastIndex;
      match = regex.exec(text);
    }

    if (last < text.length) {
      results.push(renderNonEmoji({ text: text.slice(last), key: count++ }));
    }

    return results;
  }
}
