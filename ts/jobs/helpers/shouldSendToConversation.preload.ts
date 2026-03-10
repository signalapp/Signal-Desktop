// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationModel } from '../../models/conversations.preload.js';
import type { LoggerType } from '../../types/Logging.std.js';
import { getRecipients } from '../../util/getRecipients.dom.js';
import { isConversationAccepted } from '../../util/isConversationAccepted.preload.js';
import { isConversationUnregistered } from '../../util/isConversationUnregistered.dom.js';
import { isSignalConversation } from '../../util/isSignalConversation.dom.js';
import { getUntrustedConversationServiceIds } from './getUntrustedConversationServiceIds.dom.js';

type ConversationForDirectSendType = Pick<
  ConversationModel,
  'attributes' | 'isBlocked' | 'idForLogging'
>;

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

export type DirectConversationSendRefusalType = Readonly<{
  logLine: string;
  error: Error;
}>;

export type ShouldSendToDirectConversationResult =
  | readonly [ok: true, refusal: undefined]
  | readonly [ok: false, refusal: DirectConversationSendRefusalType];

export function shouldSendToDirectConversation(
  conversation: ConversationForDirectSendType
): ShouldSendToDirectConversationResult {
  if (!isConversationAccepted(conversation.attributes)) {
    return [
      false,
      {
        logLine: `conversation ${conversation.idForLogging()} is not accepted; refusing to send`,
        error: new Error('Message request was not accepted'),
      },
    ];
  }

  if (isConversationUnregistered(conversation.attributes)) {
    return [
      false,
      {
        logLine: `conversation ${conversation.idForLogging()} is unregistered; refusing to send`,
        error: new Error('Contact no longer has a Signal account'),
      },
    ];
  }

  if (conversation.isBlocked()) {
    return [
      false,
      {
        logLine: `conversation ${conversation.idForLogging()} is blocked; refusing to send`,
        error: new Error('Contact is blocked'),
      },
    ];
  }

  return [true, undefined];
}
