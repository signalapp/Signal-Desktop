// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { MessageBody } from './conversation/MessageBody';
import { Emojify } from './conversation/Emojify';
import { AddNewLines } from './conversation/AddNewLines';

import { SizeClassType } from './emoji/lib';

import { LocalizerType, RenderTextCallbackType } from '../types/Util';

export interface Props {
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
  public render(): JSX.Element | Array<JSX.Element> {
    const { text, i18n } = this.props;
    const results: Array<JSX.Element> = [];
    const FIND_BEGIN_END = /<<left>>(.+?)<<right>>/g;

    let match = FIND_BEGIN_END.exec(text);
    let last = 0;
    let count = 1;

    if (!match) {
      return (
        <MessageBody disableJumbomoji disableLinks text={text} i18n={i18n} />
      );
    }

    const sizeClass = '';

    while (match) {
      if (last < match.index) {
        const beforeText = text.slice(last, match.index);
        count += 1;
        results.push(
          renderEmoji({
            text: beforeText,
            sizeClass,
            key: count,
            i18n,
            renderNonEmoji: renderNewLines,
          })
        );
      }

      const [, toHighlight] = match;
      count += 2;
      results.push(
        <span className="module-message-body__highlight" key={count - 1}>
          {renderEmoji({
            text: toHighlight,
            sizeClass,
            key: count,
            i18n,
            renderNonEmoji: renderNewLines,
          })}
        </span>
      );

      last = FIND_BEGIN_END.lastIndex;
      match = FIND_BEGIN_END.exec(text);
    }

    if (last < text.length) {
      count += 1;
      results.push(
        renderEmoji({
          text: text.slice(last),
          sizeClass,
          key: count,
          i18n,
          renderNonEmoji: renderNewLines,
        })
      );
    }

    return results;
  }
}
