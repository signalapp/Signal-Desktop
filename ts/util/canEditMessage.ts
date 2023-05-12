// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d';
import { HOUR } from './durations';
import { canEditMessages } from './canEditMessages';
import { isMoreRecentThan } from './timestamp';
import { isOutgoing } from '../messages/helpers';
import { isSent, someSendStatus } from '../messages/MessageSendState';

const MAX_EDIT_COUNT = 10;
const THREE_HOURS = 3 * HOUR;

export function canEditMessage(message: MessageAttributesType): boolean {
  return (
    canEditMessages() &&
    !message.deletedForEveryone &&
    isOutgoing(message) &&
    isMoreRecentThan(message.sent_at, THREE_HOURS) &&
    (message.editHistory?.length ?? 0) <= MAX_EDIT_COUNT &&
    someSendStatus(message.sendStateByConversationId, isSent) &&
    Boolean(message.body)
  );
}
