// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactNode } from 'react';

import { MESSAGE_TEXT_CLASS_NAME } from './BaseConversationListItem';
import { AtMentionify } from '../conversation/AtMentionify';
import { MessageBody } from '../conversation/MessageBody';
import { Emojify } from '../conversation/Emojify';
import { AddNewLines } from '../conversation/AddNewLines';

import { SizeClassType } from '../emoji/lib';

import {
  BodyRangesType,
  LocalizerType,
  RenderTextCallbackType,
} from '../../types/Util';

const CLASS_NAME = `${MESSAGE_TEXT_CLASS_NAME}__message-search-result-contents`;

export type Props = {
  bodyRanges: BodyRangesType;
  text: string;
  i18n: LocalizerType;
};

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
  private readonly renderNewLines: RenderTextCallbackType = ({
    text: textWithNewLines,
    key,
  }) => {
    const { bodyRanges } = this.props;
    return (
      <AddNewLines
        key={key}
        text={textWithNewLines}
        renderNonNewLine={({ text, key: innerKey }) => (
          <AtMentionify bodyRanges={bodyRanges} key={innerKey} text={text} />
        )}
      />
    );
  };

  private renderContents(): ReactNode {
    const { bodyRanges, text, i18n } = this.props;
    const results: Array<JSX.Element> = [];
    const FIND_BEGIN_END = /<<left>>(.+?)<<right>>/g;

    const processedText = AtMentionify.preprocessMentions(text, bodyRanges);

    let match = FIND_BEGIN_END.exec(processedText);
    let last = 0;
    let count = 1;

    if (!match) {
      return (
        <MessageBody
          bodyRanges={bodyRanges}
          disableJumbomoji
          disableLinks
          text={text}
          i18n={i18n}
        />
      );
    }

    const sizeClass = '';

    while (match) {
      if (last < match.index) {
        const beforeText = processedText.slice(last, match.index);
        count += 1;
        results.push(
          renderEmoji({
            text: beforeText,
            sizeClass,
            key: count,
            i18n,
            renderNonEmoji: this.renderNewLines,
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
            renderNonEmoji: this.renderNewLines,
          })}
        </span>
      );

      last = FIND_BEGIN_END.lastIndex;
      match = FIND_BEGIN_END.exec(processedText);
    }

    if (last < processedText.length) {
      count += 1;
      results.push(
        renderEmoji({
          text: processedText.slice(last),
          sizeClass,
          key: count,
          i18n,
          renderNonEmoji: this.renderNewLines,
        })
      );
    }

    return results;
  }

  public render(): ReactNode {
    return <div className={CLASS_NAME}>{this.renderContents()}</div>;
  }
}
