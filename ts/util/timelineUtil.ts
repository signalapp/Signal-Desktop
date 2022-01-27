// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber } from 'lodash';
import type { PropsType } from '../components/conversation/Timeline';
import { WidthBreakpoint } from '../components/_util';

export function fromItemIndexToRow(
  itemIndex: number,
  {
    haveOldest,
    oldestUnreadIndex,
  }: Readonly<Pick<PropsType, 'haveOldest' | 'oldestUnreadIndex'>>
): number {
  let result = itemIndex;

  // Hero row
  if (haveOldest) {
    result += 1;
  }

  // Unread indicator
  if (isNumber(oldestUnreadIndex) && itemIndex >= oldestUnreadIndex) {
    result += 1;
  }

  return result;
}

export function fromRowToItemIndex(
  row: number,
  props: Readonly<Pick<PropsType, 'haveOldest' | 'items' | 'oldestUnreadIndex'>>
): undefined | number {
  const { haveOldest, items, oldestUnreadIndex } = props;

  let result = row;

  // Hero row
  if (haveOldest) {
    result -= 1;
  }

  // Unread indicator
  if (isNumber(oldestUnreadIndex)) {
    if (result === oldestUnreadIndex) {
      return;
    }
    if (result > oldestUnreadIndex) {
      result -= 1;
    }
  }

  if (result < 0 || result >= items.length) {
    return;
  }

  return result;
}

export function getRowCount({
  haveOldest,
  items,
  oldestUnreadIndex,
  typingContactId,
}: Readonly<
  Pick<
    PropsType,
    'haveOldest' | 'items' | 'oldestUnreadIndex' | 'typingContactId'
  >
>): number {
  let result = items?.length || 0;

  // Hero row
  if (haveOldest) {
    result += 1;
  }

  // Unread indicator
  if (isNumber(oldestUnreadIndex)) {
    result += 1;
  }

  // Typing indicator
  if (typingContactId) {
    result += 1;
  }

  return result;
}

export function getHeroRow({
  haveOldest,
}: Readonly<Pick<PropsType, 'haveOldest'>>): undefined | number {
  return haveOldest ? 0 : undefined;
}

export function getLastSeenIndicatorRow(
  props: Readonly<Pick<PropsType, 'haveOldest' | 'oldestUnreadIndex'>>
): undefined | number {
  const { oldestUnreadIndex } = props;
  return isNumber(oldestUnreadIndex)
    ? fromItemIndexToRow(oldestUnreadIndex, props) - 1
    : undefined;
}

export function getTypingBubbleRow(
  props: Readonly<
    Pick<
      PropsType,
      'haveOldest' | 'items' | 'oldestUnreadIndex' | 'typingContactId'
    >
  >
): undefined | number {
  return props.typingContactId ? getRowCount(props) - 1 : undefined;
}

export function* getEphemeralRows({
  haveOldest,
  items,
  oldestUnreadIndex,
  typingContactId,
}: Readonly<
  Pick<
    PropsType,
    'haveOldest' | 'items' | 'oldestUnreadIndex' | 'typingContactId'
  >
>): Iterator<string> {
  if (haveOldest) {
    yield 'hero';
  }

  for (let i = 0; i < items.length; i += 1) {
    if (i === oldestUnreadIndex) {
      yield 'oldest-unread';
    }
    yield `item:${items[i]}`;
  }

  if (typingContactId) {
    yield 'typing-contact';
  }
}

export function getWidthBreakpoint(width: number): WidthBreakpoint {
  if (width > 606) {
    return WidthBreakpoint.Wide;
  }
  if (width > 514) {
    return WidthBreakpoint.Medium;
  }
  return WidthBreakpoint.Narrow;
}
