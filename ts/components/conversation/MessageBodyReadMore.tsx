// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { Props as MessageBodyPropsType } from './MessageBody';
import { MessageBody } from './MessageBody';
import { graphemeAndLinkAwareSlice } from '../../util/graphemeAndLinkAwareSlice';
import { shouldLinkifyMessage } from '../../types/LinkPreview';

export type Props = Pick<
  MessageBodyPropsType,
  | 'bodyRanges'
  | 'direction'
  | 'disableLinks'
  | 'i18n'
  | 'isSpoilerExpanded'
  | 'onExpandSpoiler'
  | 'kickOffBodyDownload'
  | 'renderLocation'
  | 'showConversation'
  | 'text'
  | 'textAttachment'
> & {
  id: string;
  displayLimit?: number;
  messageExpanded: (id: string, displayLimit: number) => unknown;
};

const INITIAL_LENGTH = 800;
const INCREMENT_COUNT = 3000;
const BUFFER = 100;

export function doesMessageBodyOverflow(str: string): boolean {
  return str.length > INITIAL_LENGTH + BUFFER;
}

export function MessageBodyReadMore({
  bodyRanges,
  direction,
  disableLinks,
  displayLimit,
  i18n,
  id,
  isSpoilerExpanded,
  kickOffBodyDownload,
  messageExpanded,
  onExpandSpoiler,
  renderLocation,
  showConversation,
  text,
  textAttachment,
}: Props): JSX.Element {
  const maxLength = displayLimit || INITIAL_LENGTH;

  const shouldDisableLinks = disableLinks || !shouldLinkifyMessage(text);
  const { hasReadMore, text: slicedText } = graphemeAndLinkAwareSlice(
    text,
    maxLength,
    BUFFER
  );

  const disableJumbomoji = bodyRanges?.length ? true : undefined;

  const onIncreaseTextLength = hasReadMore
    ? () => {
        messageExpanded(id, maxLength + INCREMENT_COUNT);
      }
    : undefined;

  return (
    <MessageBody
      bodyRanges={bodyRanges}
      direction={direction}
      disableJumbomoji={disableJumbomoji}
      disableLinks={shouldDisableLinks}
      i18n={i18n}
      isSpoilerExpanded={isSpoilerExpanded}
      kickOffBodyDownload={kickOffBodyDownload}
      onExpandSpoiler={onExpandSpoiler}
      onIncreaseTextLength={onIncreaseTextLength}
      renderLocation={renderLocation}
      showConversation={showConversation}
      text={slicedText}
      textAttachment={textAttachment}
    />
  );
}
