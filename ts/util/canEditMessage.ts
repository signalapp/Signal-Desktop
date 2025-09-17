// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../model-types.d.ts';
import { DAY } from './durations/index.js';
import { isMoreRecentThan } from './timestamp.js';
import { isOutgoing } from '../messages/helpers.js';
import { isMessageNoteToSelf } from './isMessageNoteToSelf.js';

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
