// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationModel } from '../../models/conversations';
import type { LoggerType } from '../../types/Logging';
import { getRecipients } from '../../util/getRecipients';
import { isConversationAccepted } from '../../util/isConversationAccepted';
import { getUntrustedConversationUuids } from './getUntrustedConversationUuids';

export function shouldSendToConversation(
  conversation: ConversationModel,
  log: LoggerType
): boolean {
  const recipients = getRecipients(conversation.attributes);
  const untrustedUuids = getUntrustedConversationUuids(recipients);

  if (untrustedUuids.length) {
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

  return true;
}
