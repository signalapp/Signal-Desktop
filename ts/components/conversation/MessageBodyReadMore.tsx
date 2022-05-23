// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { Props as MessageBodyPropsType } from './MessageBody';
import { MessageBody } from './MessageBody';
import { graphemeAwareSlice } from '../../util/graphemeAwareSlice';

export type Props = Pick<
  MessageBodyPropsType,
  | 'direction'
  | 'text'
  | 'textAttachment'
  | 'disableLinks'
  | 'i18n'
  | 'bodyRanges'
  | 'openConversation'
  | 'kickOffBodyDownload'
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
  messageExpanded,
  openConversation,
  kickOffBodyDownload,
  text,
  textAttachment,
}: Props): JSX.Element {
  const maxLength = displayLimit || INITIAL_LENGTH;

  const { hasReadMore, text: slicedText } = graphemeAwareSlice(
    text,
    maxLength,
    BUFFER
  );

  const onIncreaseTextLength = hasReadMore
    ? () => {
        messageExpanded(id, maxLength + INCREMENT_COUNT);
      }
    : undefined;

  return (
    <MessageBody
      bodyRanges={bodyRanges}
      disableLinks={disableLinks}
      direction={direction}
      i18n={i18n}
      onIncreaseTextLength={onIncreaseTextLength}
      openConversation={openConversation}
      kickOffBodyDownload={kickOffBodyDownload}
      text={slicedText}
      textAttachment={textAttachment}
    />
  );
}
