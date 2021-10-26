// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

import type { Props as MessageBodyPropsType } from './MessageBody';
import { MessageBody } from './MessageBody';

export type Props = Pick<
  MessageBodyPropsType,
  | 'direction'
  | 'text'
  | 'textPending'
  | 'disableLinks'
  | 'i18n'
  | 'bodyRanges'
  | 'openConversation'
> & {
  onHeightChange: () => unknown;
};

const INITIAL_LENGTH = 800;
const INCREMENT_COUNT = 3000;

function graphemeAwareSlice(
  str: string,
  length: number
): {
  hasReadMore: boolean;
  text: string;
} {
  if (str.length <= length) {
    return { text: str, hasReadMore: false };
  }

  let text: string | undefined;

  for (const { index } of new Intl.Segmenter().segment(str)) {
    if (!text && index >= length) {
      text = str.slice(0, index);
    }
    if (text && index > length) {
      return {
        text,
        hasReadMore: true,
      };
    }
  }

  return {
    text: str,
    hasReadMore: false,
  };
}

export function MessageBodyReadMore({
  bodyRanges,
  direction,
  disableLinks,
  i18n,
  onHeightChange,
  openConversation,
  text,
  textPending,
}: Props): JSX.Element {
  const [maxLength, setMaxLength] = useState(INITIAL_LENGTH);

  const { hasReadMore, text: slicedText } = graphemeAwareSlice(text, maxLength);

  const onIncreaseTextLength = hasReadMore
    ? () => {
        setMaxLength(oldMaxLength => oldMaxLength + INCREMENT_COUNT);
        onHeightChange();
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
      text={slicedText}
      textPending={textPending}
    />
  );
}
