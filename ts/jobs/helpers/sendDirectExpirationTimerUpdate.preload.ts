// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ContentHint } from '@signalapp/libsignal-client';

import { getSendOptions } from '../../util/getSendOptions.preload.js';
import {
  isDirectConversation,
  isMe,
} from '../../util/whatTypeOfConversation.dom.js';
import { SignalService as Proto } from '../../protobuf/index.std.js';
import {
  handleMultipleSendErrors,
  maybeExpandErrors,
} from './handleMultipleSendErrors.std.js';
import { wrapWithSyncMessageSend } from '../../util/wrapWithSyncMessageSend.preload.js';
import { ourProfileKeyService } from '../../services/ourProfileKey.std.js';

import type { ConversationModel } from '../../models/conversations.preload.js';
import type {
  ExpirationTimerUpdateJobData,
  ConversationQueueJobBundle,
} from '../conversationJobQueue.preload.js';
import { handleMessageSend } from '../../util/handleMessageSend.preload.js';
import { isConversationAccepted } from '../../util/isConversationAccepted.preload.js';
import { isConversationUnregistered } from '../../util/isConversationUnregistered.dom.js';
import { DurationInSeconds } from '../../util/durations/index.std.js';

export async function sendDirectExpirationTimerUpdate(
  conversation: ConversationModel,
  {
    isFinalAttempt,
    messaging,
    shouldContinue,
    timeRemaining,
    timestamp,
    log,
  }: ConversationQueueJobBundle,
  data: ExpirationTimerUpdateJobData
): Promise<void> {
  if (!shouldContinue) {
    log.info('Ran out of time. Giving up on sending expiration timer update');
    return;
  }

  if (!isDirectConversation(conversation.attributes)) {
    log.error(
      `Conversation ${conversation.idForLogging()} is not a 1:1 conversation; canceling expiration timer job.`
    );
    return;
  }

  if (conversation.isUntrusted()) {
    const serviceId = conversation.getCheckedServiceId(
      'Expiration timer send blocked: untrusted and missing serviceId!'
    );
    window.reduxActions.conversations.conversationStoppedByMissingVerification({
      conversationId: conversation.id,
      untrustedServiceIds: [serviceId],
    });
    throw new Error(
      'Expiration timer send blocked because conversation is untrusted. Failing this attempt.'
    );
  }

  log.info(
    `Starting expiration timer update for ${conversation.idForLogging()} with timestamp ${timestamp}`
  );

  const { expireTimer } = data;

  const sendOptions = await getSendOptions(conversation.attributes);
  let profileKey: Uint8Array | undefined;
  if (conversation.get('profileSharing')) {
    profileKey = await ourProfileKeyService.get();
  }

  const contentHint = ContentHint.Resendable;

  const sendType = 'expirationTimerUpdate';
  const flags = Proto.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;
  const proto = await messaging.getContentMessage({
    // `expireTimer` is already in seconds
    expireTimer:
      expireTimer === undefined
        ? undefined
        : DurationInSeconds.fromSeconds(expireTimer),
    expireTimerVersion: conversation.getExpireTimerVersion(),
    flags,
    profileKey,
    recipients: conversation.getRecipients(),
    timestamp,
    includePniSignatureMessage: true,
  });

  if (!proto.dataMessage) {
    log.error(
      "ContentMessage proto didn't have a data message; canceling job."
    );
    return;
  }

  const logId = `expirationTimerUdate/${conversation.idForLogging()}`;

  try {
    if (isMe(conversation.attributes)) {
      await handleMessageSend(
        messaging.sendSyncMessage({
          encodedDataMessage: Proto.DataMessage.encode(
            proto.dataMessage
          ).finish(),
          destinationE164: conversation.get('e164'),
          destinationServiceId: conversation.getServiceId(),
          expirationStartTimestamp: null,
          options: sendOptions,
          timestamp,
          urgent: false,
        }),
        { messageIds: [], sendType }
      );
    } else if (isDirectConversation(conversation.attributes)) {
      if (!isConversationAccepted(conversation.attributes)) {
        log.info(
          `conversation ${conversation.idForLogging()} is not accepted; refusing to send`
        );
        return;
      }
      if (isConversationUnregistered(conversation.attributes)) {
        log.info(
          `conversation ${conversation.idForLogging()} is unregistered; refusing to send`
        );
        return;
      }
      if (conversation.isBlocked()) {
        log.info(
          `conversation ${conversation.idForLogging()} is blocked; refusing to send`
        );
        return;
      }

      await wrapWithSyncMessageSend({
        conversation,
        logId,
        messageIds: [],
        send: async sender =>
          sender.sendIndividualProto({
            contentHint,
            serviceId: conversation.getSendTarget(),
            options: sendOptions,
            proto,
            timestamp,
            urgent: false,
          }),
        sendType,
        timestamp,
      });
    }
  } catch (error: unknown) {
    await handleMultipleSendErrors({
      errors: maybeExpandErrors(error),
      isFinalAttempt,
      log,
      timeRemaining,
      toThrow: error,
    });
  }
}
