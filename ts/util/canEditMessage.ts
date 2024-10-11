// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../model-types.d';
import { DAY } from './durations';
import { isMoreRecentThan } from './timestamp';
import { isOutgoing } from '../messages/helpers';
import { isMessageNoteToSelf } from './isMessageNoteToSelf';

export const MESSAGE_MAX_EDIT_COUNT = 10;

export function canEditMessage(
  message: ReadonlyMessageAttributesType
): boolean {
  return (
    !message.sms &&
    !message.deletedForEveryone &&
    isOutgoing(message) &&
    (isMoreRecentThan(message.sent_at, DAY) || isMessageNoteToSelf(message)) &&
    Boolean(message.body)
  );
}

export function isWithinMaxEdits(
  message: ReadonlyMessageAttributesType
): boolean {
  return (
    isMessageNoteToSelf(message) ||
    (message.editHistory?.length ?? 0) <= MESSAGE_MAX_EDIT_COUNT
  );
}
