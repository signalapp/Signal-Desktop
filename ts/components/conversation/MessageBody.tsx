// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { getSizeClass, SizeClassType } from '../emoji/lib';
import { AtMentionify } from './AtMentionify';
import { Emojify } from './Emojify';
import { AddNewLines } from './AddNewLines';
import { Linkify } from './Linkify';

import {
  BodyRangesType,
  LocalizerType,
  RenderTextCallbackType,
} from '../../types/Util';

type OpenConversationActionType = (
  conversationId: string,
  messageId?: string
) => void;

export interface Props {
  direction?: 'incoming' | 'outgoing';
  text: string;
  textPending?: boolean;
  /** If set, all emoji will be the same size. Otherwise, just one emoji will be large. */
  disableJumbomoji?: boolean;
  /** If set, links will be left alone instead of turned into clickable `<a>` tags. */
  disableLinks?: boolean;
  i18n: LocalizerType;
  bodyRanges?: BodyRangesType;
  openConversation?: OpenConversationActionType;
}

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

/**
 * This component makes it very easy to use all three of our message formatting
 * components: `Emojify`, `Linkify`, and `AddNewLines`. Because each of them is fully
 * configurable with their `renderXXX` props, this component will assemble all three of
 * them for you.
 */
export class MessageBody extends React.Component<Props> {
  private readonly renderNewLines: RenderTextCallbackType = ({
    text: textWithNewLines,
    key,
  }) => {
    const { bodyRanges, direction, openConversation } = this.props;
    return (
      <AddNewLines
        key={key}
        text={textWithNewLines}
        renderNonNewLine={({ text, key: innerKey }) => (
          <AtMentionify
            key={innerKey}
            direction={direction}
            text={text}
            bodyRanges={bodyRanges}
            openConversation={openConversation}
          />
        )}
      />
    );
  };

  public addDownloading(jsx: JSX.Element): JSX.Element {
    const { i18n, textPending } = this.props;

    return (
      <span>
        {jsx}
        {textPending ? (
          <span className="module-message-body__highlight">
            {' '}
            {i18n('downloading')}
          </span>
        ) : null}
      </span>
    );
  }

  public render(): JSX.Element {
    const {
      bodyRanges,
      text,
      textPending,
      disableJumbomoji,
      disableLinks,
      i18n,
    } = this.props;
    const sizeClass = disableJumbomoji ? undefined : getSizeClass(text);
    const textWithPending = AtMentionify.preprocessMentions(
      textPending ? `${text}...` : text,
      bodyRanges
    );

    if (disableLinks) {
      return this.addDownloading(
        renderEmoji({
          i18n,
          text: textWithPending,
          sizeClass,
          key: 0,
          renderNonEmoji: this.renderNewLines,
        })
      );
    }

    return this.addDownloading(
      <Linkify
        text={textWithPending}
        renderNonLink={({ key, text: nonLinkText }) => {
          return renderEmoji({
            i18n,
            text: nonLinkText,
            sizeClass,
            key,
            renderNonEmoji: this.renderNewLines,
          });
        }}
      />
    );
  }
}
