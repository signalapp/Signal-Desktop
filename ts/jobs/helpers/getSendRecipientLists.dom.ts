// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ServiceIdString } from '@signalapp/mock-server/src/types';
import type { ConversationModel } from '../../models/conversations.preload.js';
import type { LoggerType } from '../../types/Logging.std.js';
import { isMe } from '../../util/whatTypeOfConversation.dom.js';
import { isSignalConversation } from '../../util/isSignalConversation.dom.js';

export type SendRecipientLists = Readonly<{
  allRecipientServiceIds: Array<ServiceIdString>;
  recipientServiceIdsWithoutMe: Array<ServiceIdString>;
  untrustedServiceIds: Array<ServiceIdString>;
}>;

export type GetSendRecipientListsOptions = Readonly<{
  log: LoggerType;
  conversationIds: ReadonlyArray<string>;
  conversation: ConversationModel;
}>;

export function getSendRecipientLists(
  options: GetSendRecipientListsOptions
): SendRecipientLists {
  const { log, conversationIds, conversation } = options;

  const allRecipientServiceIds: Array<ServiceIdString> = [];
  const recipientServiceIdsWithoutMe: Array<ServiceIdString> = [];
  const untrustedServiceIds: Array<ServiceIdString> = [];

  const memberConversationIds = conversation.getMemberConversationIds();

  for (const conversationId of conversationIds) {
    const recipient = window.ConversationController.get(conversationId);
    if (!recipient) {
      log.warn(
        `getRecipients/${conversationId}: Missing conversation, dropping recipient`
      );
      continue;
    }

    const logPrefix = `getRecipients/${recipient.idForLogging()}`;

    const sendTarget = recipient.getSendTarget();
    if (sendTarget == null) {
      log.warn(`${logPrefix}: Missing send target, dropping recipient`);
      continue;
    }

    const isRecipientMe = isMe(recipient.attributes);
    const isRecipientMember = memberConversationIds.has(conversationId);

    if (!(isRecipientMember || isRecipientMe)) {
      log.warn(
        `${logPrefix}: Recipient is not a member of conversation, dropping`
      );
      continue;
    }

    if (recipient.isUntrusted()) {
      const serviceId = recipient.getServiceId();
      if (!serviceId) {
        log.error(
          `${logPrefix}: Recipient is untrusted and missing serviceId, dropping`
        );
        continue;
      }
      untrustedServiceIds.push(serviceId);
      continue;
    }

    if (recipient.isUnregistered()) {
      log.warn(`${logPrefix}: Recipient is unregistered, dropping`);
      continue;
    }

    if (recipient.isBlocked()) {
      log.warn(`${logPrefix}: Recipient is blocked, dropping`);
      continue;
    }

    if (isSignalConversation(recipient.attributes)) {
      log.info(`${logPrefix}: Recipient is Signal conversation, dropping`);
      continue;
    }

    allRecipientServiceIds.push(sendTarget);
    if (!isRecipientMe) {
      recipientServiceIdsWithoutMe.push(sendTarget);
    }
  }

  return {
    allRecipientServiceIds,
    recipientServiceIdsWithoutMe,
    untrustedServiceIds,
  };
}
