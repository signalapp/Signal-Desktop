// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber, sortBy } from 'lodash';

import { strictAssert } from './assert';

import type { EditHistoryType, MessageAttributesType } from '../model-types';
import type { LoggerType } from '../types/Logging';
import { getMessageIdForLogging } from './idForLogging';
import type { MessageModel } from '../models/messages';

// The tricky bit for this function is if we are on our second+ attempt to send a given
//   edit, we're still sending that edit.
export function getTargetOfThisEditTimestamp({
  message,
  targetTimestamp,
}: {
  message: MessageModel;
  targetTimestamp: number;
}): number {
  const originalTimestamp = message.get('timestamp');
  const editHistory = message.get('editHistory') || [];

  const sentItems = editHistory.filter(item => {
    return item.timestamp <= targetTimestamp;
  });
  const mostRecent = sortBy(
    sentItems,
    (item: EditHistoryType) => item.timestamp
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

export function getPropForTimestamp<T extends keyof EditHistoryType>({
  log,
  message,
  prop,
  targetTimestamp,
}: {
  log: LoggerType;
  message: MessageModel | MessageAttributesType;
  prop: T;
  targetTimestamp: number;
}): EditHistoryType[T] {
  const attributes =
    message instanceof window.Whisper.Message ? message.attributes : message;

  const logId = `getPropForTimestamp(${getMessageIdForLogging(
    attributes
  )}, target=${targetTimestamp}})`;

  const { editHistory } = attributes;
  const targetEdit = editHistory?.find(
    item => item.timestamp === targetTimestamp
  );
  if (!targetEdit) {
    if (editHistory) {
      log.warn(`${logId}: No edit found, using top-level data`);
    }
    return attributes[prop];
  }

  return targetEdit[prop];
}

export function setPropForTimestamp<T extends keyof EditHistoryType>({
  log,
  message,
  prop,
  targetTimestamp,
  value,
}: {
  log: LoggerType;
  message: MessageModel;
  prop: T;
  targetTimestamp: number;
  value: EditHistoryType[T];
}): void {
  const logId = `setPropForTimestamp(${message.idForLogging()}, target=${targetTimestamp}})`;

  const editHistory = message.get('editHistory');
  const targetEditIndex = editHistory?.findIndex(
    item => item.timestamp === targetTimestamp
  );
  const targetEdit =
    editHistory && isNumber(targetEditIndex)
      ? editHistory[targetEditIndex]
      : undefined;

  if (!targetEdit) {
    if (editHistory) {
      log.warn(`${logId}: No edit found, updating top-level data`);
    }
    message.set({
      [prop]: value,
    });
    return;
  }

  strictAssert(editHistory, 'Got targetEdit, but no editHistory');
  strictAssert(
    isNumber(targetEditIndex),
    'Got targetEdit, but no targetEditIndex'
  );

  const newEditHistory = [...editHistory];
  newEditHistory[targetEditIndex] = { ...targetEdit, [prop]: value };

  message.set('editHistory', newEditHistory);

  // We always edit the top-level attribute if this is the most recent send
  const editMessageTimestamp = message.get('editMessageTimestamp');
  if (!editMessageTimestamp || editMessageTimestamp === targetTimestamp) {
    message.set({
      [prop]: value,
    });
  }
}
