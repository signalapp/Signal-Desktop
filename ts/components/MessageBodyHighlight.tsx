import React from 'react';

import { MessageBody } from './conversation/MessageBody';
import { Emojify } from './conversation/Emojify';
import { AddNewLines } from './conversation/AddNewLines';

import { SizeClassType } from './emoji/lib';

import { LocalizerType, RenderTextCallbackType } from '../types/Util';

interface Props {
  text: string;
  i18n: LocalizerType;
}

const renderNewLines: RenderTextCallbackType = ({ text, key }) => (
  <AddNewLines key={key} text={text} />
);

const renderEmoji = ({
  text,
  key,
  sizeClass,
  renderNonEmoji,
}: {
  i18n: LocalizerType;
  text: string;
  key: number;
  sizeClass?: SizeClassType;
  renderNonEmoji: RenderTextCallbackType;
}) => (
  <Emojify
    key={key}
    text={text}
    sizeClass={sizeClass}
    renderNonEmoji={renderNonEmoji}
  />
);

export class MessageBodyHighlight extends React.Component<Props> {
  public render() {
    const { text, i18n } = this.props;
    const results: Array<any> = [];
    const FIND_BEGIN_END = /<<left>>(.+?)<<right>>/g;

    let match = FIND_BEGIN_END.exec(text);
    let last = 0;
    let count = 1;

    if (!match) {
      return (
        <MessageBody
          disableJumbomoji={true}
          disableLinks={true}
          text={text}
          i18n={i18n}
        />
      );
    }

    const sizeClass = '';

    while (match) {
      if (last < match.index) {
        const beforeText = text.slice(last, match.index);
        results.push(
          renderEmoji({
            text: beforeText,
            sizeClass,
            key: count++,
            i18n,
            renderNonEmoji: renderNewLines,
          })
        );
      }

      const [, toHighlight] = match;
      results.push(
        <span className="module-message-body__highlight" key={count++}>
          {renderEmoji({
            text: toHighlight,
            sizeClass,
            key: count++,
            i18n,
            renderNonEmoji: renderNewLines,
          })}
        </span>
      );

      // @ts-ignore
      last = FIND_BEGIN_END.lastIndex;
      match = FIND_BEGIN_END.exec(text);
    }

    if (last < text.length) {
      results.push(
        renderEmoji({
          text: text.slice(last),
          sizeClass,
          key: count++,
          i18n,
          renderNonEmoji: renderNewLines,
        })
      );
    }

    return results;
  }
}
