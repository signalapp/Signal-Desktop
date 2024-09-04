// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../model-types.d';
import { DAY } from './durations';
import { isMoreRecentThan } from './timestamp';
import { isOutgoing } from '../messages/helpers';

export const MESSAGE_MAX_EDIT_COUNT = 10;

export function canEditMessage(
  message: ReadonlyMessageAttributesType
): boolean {
  if (message.sms) {
    return false;
  }

  const result =
    !message.deletedForEveryone &&
    isOutgoing(message) &&
    isMoreRecentThan(message.sent_at, DAY) &&
    Boolean(message.body);

  if (result) {
    return true;
  }

  if (
    message.conversationId ===
    window.ConversationController.getOurConversationId()
  ) {
    return !message.deletedForEveryone && Boolean(message.body);
  }

  return false;
}

export function isWithinMaxEdits(
  message: ReadonlyMessageAttributesType
): boolean {
  return (message.editHistory?.length ?? 0) <= MESSAGE_MAX_EDIT_COUNT;
}
