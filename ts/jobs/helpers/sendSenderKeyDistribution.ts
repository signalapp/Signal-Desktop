// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { handleMessageSend } from '../../util/handleMessageSend';
import { getSendOptions } from '../../util/getSendOptions';
import { isDirectConversation } from '../../util/whatTypeOfConversation';
import {
  handleMultipleSendErrors,
  maybeExpandErrors,
} from './handleMultipleSendErrors';

import type { ConversationModel } from '../../models/conversations';
import type {
  ConversationQueueJobBundle,
  SenderKeyDistributionJobData,
} from '../conversationJobQueue';
import { isConversationUnregistered } from '../../util/isConversationUnregistered';
import {
  NoSenderKeyError,
  OutgoingIdentityKeyError,
  UnregisteredUserError,
} from '../../textsecure/Errors';
import { shouldSendToConversation } from './shouldSendToConversation';

// Note: in regular scenarios, sender keys are sent as part of a group send. This job type
//   is only used in decryption error recovery scenarios.
export async function sendSenderKeyDistribution(
  conversation: ConversationModel,
  {
    isFinalAttempt,
    messaging,
    shouldContinue,
    timestamp,
    timeRemaining,
    log,
  }: ConversationQueueJobBundle,
  data: SenderKeyDistributionJobData
): Promise<void> {
  if (!shouldContinue) {
    log.info(
      'Ran out of time. Giving up on sending sender key distribution message'
    );
    return;
  }

  log.info(
    `starting sender key distribution message send to ${conversation.idForLogging()} with timestamp ${timestamp}`
  );

  if (!isDirectConversation(conversation.attributes)) {
    log.info('Failing attempt to send null message to group');
    return;
  }

  if (!shouldSendToConversation(conversation, log)) {
    return;
  }

  if (isConversationUnregistered(conversation.attributes)) {
    log.info(
      `conversation ${conversation.idForLogging()} is unregistered; refusing to send sender key distribution message`
    );
    return;
  }

  const sendOptions = await getSendOptions(conversation.attributes);
  const { groupId } = data;
  const group = window.ConversationController.get(groupId);
  const distributionId = group?.get('senderKeyInfo')?.distributionId;
  const uuid = conversation.get('uuid');

  if (!distributionId) {
    log.info(
      `group ${group?.idForLogging()} had no distributionid, cancelling job.`
    );
    return;
  }

  if (!uuid) {
    log.info(
      `conversation ${conversation.idForLogging()} was missing uuid, cancelling job.`
    );
    return;
  }

  try {
    await handleMessageSend(
      messaging.sendSenderKeyDistributionMessage(
        {
          distributionId,
          groupId,
          identifiers: [uuid],
          throwIfNotInDatabase: true,
          urgent: false,
        },
        sendOptions
      ),
      { messageIds: [], sendType: 'senderKeyDistributionMessage' }
    );
  } catch (error: unknown) {
    if (
      error instanceof NoSenderKeyError ||
      error instanceof OutgoingIdentityKeyError ||
      error instanceof UnregisteredUserError
    ) {
      log.info(
        'Send failure was NoSenderKeyError, OutgoingIdentityKeyError or UnregisteredUserError. Cancelling job.'
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
