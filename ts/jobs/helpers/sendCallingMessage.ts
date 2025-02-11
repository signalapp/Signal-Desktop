// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { handleMessageSend } from '../../util/handleMessageSend';
import { getSendOptions } from '../../util/getSendOptions';
import {
  isDirectConversation,
  isGroup,
} from '../../util/whatTypeOfConversation';
import { SignalService as Proto } from '../../protobuf';
import {
  handleMultipleSendErrors,
  maybeExpandErrors,
} from './handleMultipleSendErrors';

import type { ConversationModel } from '../../models/conversations';
import type {
  ConversationQueueJobBundle,
  CallingMessageJobData,
} from '../conversationJobQueue';
import { isConversationUnregistered } from '../../util/isConversationUnregistered';
import {
  OutgoingIdentityKeyError,
  UnregisteredUserError,
} from '../../textsecure/Errors';
import { getUntrustedConversationServiceIds } from './getUntrustedConversationServiceIds';
import { sendContentMessageToGroup } from '../../util/sendToGroup';
import * as Bytes from '../../Bytes';
import { getValidRecipients } from './getValidRecipients';

export async function sendCallingMessage(
  conversation: ConversationModel,
  {
    isFinalAttempt,
    messaging,
    shouldContinue,
    timestamp,
    timeRemaining,
    log,
  }: ConversationQueueJobBundle,
  data: CallingMessageJobData
): Promise<void> {
  const logId = `sendCallingMessage(${conversation.idForLogging()}.${timestamp})`;
  if (!shouldContinue) {
    log.info(`${logId}: Ran out of time. Giving up.`);
    return;
  }

  log.info(`${logId}: Starting send`);

  if (
    isDirectConversation(conversation.attributes) &&
    isConversationUnregistered(conversation.attributes)
  ) {
    log.warn(`${logId}: Direct conversation is unregistered; refusing to send`);
    return;
  }

  const {
    protoBase64,
    urgent,
    recipients: jobRecipients,
    isPartialSend,
    groupId,
  } = data;

  const recipients = getValidRecipients(
    jobRecipients || conversation.getRecipients(),
    { log, logId }
  );

  const untrustedServiceIds = getUntrustedConversationServiceIds(recipients);
  if (untrustedServiceIds.length) {
    window.reduxActions.conversations.conversationStoppedByMissingVerification({
      conversationId: conversation.id,
      untrustedServiceIds,
    });
    throw new Error(
      `${logId}: Blocked because ${untrustedServiceIds.length} conversation(s) were untrusted. Failing this attempt.`
    );
  }

  if (recipients.length === 0) {
    log.warn(`${logId}: Giving up because there are no valid recipients.`);
    return;
  }

  const sendType = 'callingMessage';
  const sendOptions = await getSendOptions(conversation.attributes, {
    groupId,
  });

  const callMessage = Proto.CallMessage.decode(Bytes.fromBase64(protoBase64));

  const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

  try {
    if (isGroup(conversation.attributes)) {
      await handleMessageSend(
        sendContentMessageToGroup({
          contentHint: ContentHint.DEFAULT,
          contentMessage: new Proto.Content({ callMessage }),
          isPartialSend,
          messageId: undefined,
          recipients,
          sendOptions,
          sendTarget: conversation.toSenderKeyTarget(),
          sendType,
          timestamp,
          urgent,
        }),
        { messageIds: [], sendType }
      );
    } else {
      const sendTarget = conversation.getSendTarget();
      if (!sendTarget) {
        log.error(`${logId}: Direct conversation send target is falsy`);
        return;
      }
      await handleMessageSend(
        messaging.sendCallingMessage(
          sendTarget,
          callMessage,
          timestamp,
          urgent,
          sendOptions
        ),
        { messageIds: [], sendType }
      );
    }
  } catch (error: unknown) {
    if (
      error instanceof OutgoingIdentityKeyError ||
      error instanceof UnregisteredUserError
    ) {
      log.info(
        `${logId}: Send failure was OutgoingIdentityKeyError or UnregisteredUserError. Cancelling job.`
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
