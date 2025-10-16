// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationModel } from '../../models/conversations.preload.js';
import type { LoggerType } from '../../types/Logging.std.js';
import { getRecipients } from '../../util/getRecipients.dom.js';
import { isConversationAccepted } from '../../util/isConversationAccepted.preload.js';
import { isSignalConversation } from '../../util/isSignalConversation.dom.js';
import { getUntrustedConversationServiceIds } from './getUntrustedConversationServiceIds.dom.js';

export function shouldSendToConversation(
  conversation: ConversationModel,
  log: LoggerType
): boolean {
  const recipients = getRecipients(conversation.attributes);
  const untrustedServiceIds = getUntrustedConversationServiceIds(recipients);

  if (untrustedServiceIds.length) {
    log.info(
      `conversation ${conversation.idForLogging()} has untrusted recipients; refusing to send`
    );
    return false;
  }

  if (!isConversationAccepted(conversation.attributes)) {
    log.info(
      `conversation ${conversation.idForLogging()} is not accepted; refusing to send`
    );
    return false;
  }

  if (conversation.isBlocked()) {
    log.info(
      `conversation ${conversation.idForLogging()} is blocked; refusing to send`
    );
    return false;
  }

  if (isSignalConversation(conversation.attributes)) {
    log.info(
      `conversation ${conversation.idForLogging()} is Signal conversation; refusing to send`
    );
    return false;
  }

  return true;
}
