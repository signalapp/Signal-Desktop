// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect } from 'react';

import type { Props as MessageBodyPropsType } from './MessageBody';
import { MessageBody } from './MessageBody';
import { usePrevious } from '../../hooks/usePrevious';

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
  id: string;
  displayLimit?: number;
  messageExpanded: (id: string, displayLimit: number) => unknown;
  onHeightChange: () => unknown;
};

const INITIAL_LENGTH = 800;
const INCREMENT_COUNT = 3000;
const BUFFER = 100;

export function doesMessageBodyOverflow(str: string): boolean {
  return str.length > INITIAL_LENGTH + BUFFER;
}

function graphemeAwareSlice(
  str: string,
  length: number
): {
  hasReadMore: boolean;
  text: string;
} {
  if (str.length <= length + BUFFER) {
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
  displayLimit,
  i18n,
  id,
  messageExpanded,
  onHeightChange,
  openConversation,
  text,
  textPending,
}: Props): JSX.Element {
  const maxLength = displayLimit || INITIAL_LENGTH;
  const previousMaxLength = usePrevious(maxLength, maxLength);

  useEffect(() => {
    if (previousMaxLength !== maxLength) {
      onHeightChange();
    }
  }, [maxLength, previousMaxLength, onHeightChange]);

  const { hasReadMore, text: slicedText } = graphemeAwareSlice(text, maxLength);

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
      text={slicedText}
      textPending={textPending}
    />
  );
}
