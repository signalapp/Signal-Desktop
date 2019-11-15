import React from 'react';

import classNames from 'classnames';
import is from '@sindresorhus/is';

import {
  findImage,
  getRegex,
  getReplacementData,
  getTitle,
  SizeClassType,
} from '../../util/emoji';

import { LocalizerType, RenderTextCallbackType } from '../../types/Util';

// Some of this logic taken from emoji-js/replacement
function getImageTag({
  match,
  sizeClass,
  key,
  i18n,
}: {
  match: any;
  sizeClass?: SizeClassType;
  key: string | number;
  i18n: LocalizerType;
}) {
  const result = getReplacementData(match[0], match[1], match[2]);

  if (is.string(result)) {
    return <span key={key}>{match[0]}</span>;
  }

  const img = findImage(result.value, result.variation);
  const title = getTitle(result.value);

  return (
    // tslint:disable-next-line react-a11y-img-has-alt
    <img
      key={key}
      src={img.path}
      // We can't use alt or it will be what is captured when a user copies message
      //   contents ("Emoji of ':1'"). Instead, we want the title to be copied (':+1:').
      aria-label={i18n('emojiAlt', [title || ''])}
      className={classNames('emoji', sizeClass)}
      data-codepoints={img.full_idx}
      title={`:${title}:`}
    />
  );
}

interface Props {
  text: string;
  /** A class name to be added to the generated emoji images */
  sizeClass?: SizeClassType;
  /** Allows you to customize now non-newlines are rendered. Simplest is just a <span>. */
  renderNonEmoji?: RenderTextCallbackType;
  i18n: LocalizerType;
  isGroup?: boolean;
  convoId: string;
}

export class Emojify extends React.Component<Props> {
  public static defaultProps: Partial<Props> = {
    renderNonEmoji: ({ text }) => text || '',
    isGroup: false,
  };

  public render() {
    const {
      text,
      sizeClass,
      renderNonEmoji,
      i18n,
      isGroup,
      convoId,
    } = this.props;
    const results: Array<any> = [];
    const regex = getRegex();

    // We have to do this, because renderNonEmoji is not required in our Props object,
    //  but it is always provided via defaultProps.
    if (!renderNonEmoji) {
      return null;
    }

    let match = regex.exec(text);
    let last = 0;
    let count = 1;

    if (!match) {
      return renderNonEmoji({ text, key: 0, isGroup, convoId });
    }

    while (match) {
      if (last < match.index) {
        const textWithNoEmoji = text.slice(last, match.index);
        results.push(
          renderNonEmoji({
            text: textWithNoEmoji,
            key: count++,
            isGroup,
            convoId,
          })
        );
      }

      results.push(getImageTag({ match, sizeClass, key: count++, i18n }));

      last = regex.lastIndex;
      match = regex.exec(text);
    }

    if (last < text.length) {
      results.push(
        renderNonEmoji({
          text: text.slice(last),
          key: count++,
          isGroup,
          convoId,
        })
      );
    }

    return results;
  }
}
