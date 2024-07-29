// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber, sortBy } from 'lodash';
import type { ReadonlyDeep } from 'type-fest';

import { strictAssert } from './assert';

import type {
  EditHistoryType,
  MessageAttributesType,
  ReadonlyMessageAttributesType,
} from '../model-types';
import type { LoggerType } from '../types/Logging';

// The tricky bit for this function is if we are on our second+ attempt to send a given
//   edit, we're still sending that edit.
export function getTargetOfThisEditTimestamp({
  message,
  targetTimestamp,
}: {
  message: ReadonlyMessageAttributesType;
  targetTimestamp: number;
}): number {
  const { timestamp: originalTimestamp, editHistory } = message;
  if (!editHistory) {
    return originalTimestamp;
  }

  const sentItems = editHistory.filter(item => {
    return item.timestamp <= targetTimestamp;
  });
  const mostRecent = sortBy(
    sentItems,
    (item: ReadonlyDeep<EditHistoryType>) => item.timestamp
  );

  const { length } = mostRecent;

  // We want the second-to-last item, because we may have partially sent targetTimestamp
  if (length > 1) {
    return mostRecent[length - 2].timestamp;
  }
  // If there's only one item, we'll use it
  if (length > 0) {
    return mostRecent[length - 1].timestamp;
  }

  // This is a good failover in case we ever stop duplicating data in editHistory
  return originalTimestamp;
}

export function getPropForTimestamp<
  Attrs extends ReadonlyMessageAttributesType,
  T extends keyof EditHistoryType,
>({
  log,
  message,
  prop,
  targetTimestamp,
}: {
  log: LoggerType;
  message: Attrs;
  prop: T;
  targetTimestamp: number;
}): Attrs[T] {
  const logId = `getPropForTimestamp(${targetTimestamp}})`;

  const { editHistory } = message;
  const targetEdit = editHistory?.find(
    item => item.timestamp === targetTimestamp
  );
  if (!targetEdit) {
    if (editHistory) {
      log.warn(`${logId}: No edit found, using top-level data`);
    }
    return message[prop];
  }

  return targetEdit[prop] as Attrs[T];
}

export function getChangesForPropAtTimestamp<T extends keyof EditHistoryType>({
  log,
  message,
  prop,
  targetTimestamp,
  value,
}: {
  log: LoggerType;
  message: MessageAttributesType;
  prop: T;
  targetTimestamp: number;
  value: EditHistoryType[T];
}): Partial<MessageAttributesType> | undefined {
  const logId = `getChangesForPropAtTimestamp(${targetTimestamp})`;

  const { editHistory } = message;
  let partialProps: Partial<MessageAttributesType> | undefined;

  if (editHistory) {
    const targetEditIndex = editHistory.findIndex(
      item => item.timestamp === targetTimestamp
    );
    const targetEdit = isNumber(targetEditIndex)
      ? editHistory[targetEditIndex]
      : undefined;

    if (!targetEdit) {
      if (editHistory) {
        log.warn(`${logId}: No edit found, updating top-level data`);
      }
      return {
        [prop]: value,
      };
    }

    strictAssert(
      isNumber(targetEditIndex),
      'Got targetEdit, but no targetEditIndex'
    );

    const newEditHistory = [...editHistory];
    newEditHistory[targetEditIndex] = { ...targetEdit, [prop]: value };

    partialProps = {
      editHistory: newEditHistory,
    };
  }

  // We always edit the top-level attribute if this is the most recent send
  const { editMessageTimestamp } = message;
  if (
    !editHistory ||
    !editMessageTimestamp ||
    editMessageTimestamp === targetTimestamp
  ) {
    partialProps = {
      ...partialProps,
      [prop]: value,
    };
  }

  return partialProps;
}
