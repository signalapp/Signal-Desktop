// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { handleMessageSend } from '../../util/handleMessageSend.preload.js';
import { getSendOptions } from '../../util/getSendOptions.preload.js';
import { isDirectConversation } from '../../util/whatTypeOfConversation.dom.js';
import { SignalService as Proto } from '../../protobuf/index.std.js';
import {
  handleMultipleSendErrors,
  maybeExpandErrors,
} from './handleMultipleSendErrors.std.js';

import type { ConversationModel } from '../../models/conversations.preload.js';
import type {
  ConversationQueueJobBundle,
  SavedProtoJobData,
} from '../conversationJobQueue.preload.js';
import { isConversationUnregistered } from '../../util/isConversationUnregistered.dom.js';
import {
  OutgoingIdentityKeyError,
  UnregisteredUserError,
} from '../../textsecure/Errors.std.js';
import * as Bytes from '../../Bytes.std.js';

export async function sendSavedProto(
  conversation: ConversationModel,
  {
    isFinalAttempt,
    messaging,
    shouldContinue,
    timestamp,
    timeRemaining,
    log,
  }: ConversationQueueJobBundle,
  data: SavedProtoJobData
): Promise<void> {
  if (!shouldContinue) {
    log.info('Ran out of time. Giving up on sending null message');
    return;
  }

  log.info(
    `starting saved proto send to ${conversation.idForLogging()} with timestamp ${timestamp}`
  );

  if (!isDirectConversation(conversation.attributes)) {
    log.info('Failing attempt to send null message to group');
    return;
  }

  // Note: we will send to blocked users, to those still in message request state, etc.
  //   Any needed blocking should still apply once the decryption error is fixed.

  if (isConversationUnregistered(conversation.attributes)) {
    log.info(
      `conversation ${conversation.idForLogging()} is unregistered; refusing to send null message`
    );
    return;
  }

  const serviceId = conversation.getServiceId();
  if (!serviceId) {
    log.info(
      `conversation ${conversation.idForLogging()} was missing serviceId, canceling job.`
    );
    return;
  }

  const {
    protoBase64,
    groupId,
    contentHint,
    story,
    timestamp: originalTimestamp,
    urgent,
  } = data;
  const sendOptions = await getSendOptions(conversation.attributes, { story });
  const sendType = 'resendFromLog';

  try {
    const proto = Proto.Content.decode(Bytes.fromBase64(protoBase64));
    await handleMessageSend(
      messaging.sendMessageProtoAndWait({
        contentHint,
        groupId,
        options: sendOptions,
        proto,
        recipients: [serviceId],
        timestamp: originalTimestamp,
        urgent,
        story,
      }),
      {
        messageIds: [],
        sendType,
      }
    );
  } catch (error: unknown) {
    if (
      error instanceof OutgoingIdentityKeyError ||
      error instanceof UnregisteredUserError
    ) {
      log.info(
        'Send failure was OutgoingIdentityKeyError or UnregisteredUserError. Canceling job.'
      );
      return;
    }

    await handleMultipleSendErrors({
      errors: maybeExpandErrors(error),
      isFinalAttempt,
      log,
      timeRemaining,
      toThrow: error,
    });
  }
}
