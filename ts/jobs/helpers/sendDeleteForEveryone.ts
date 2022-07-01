// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber } from 'lodash';

import * as Errors from '../../types/errors';
import { getSendOptions } from '../../util/getSendOptions';
import {
  isDirectConversation,
  isGroupV2,
  isMe,
} from '../../util/whatTypeOfConversation';
import { SignalService as Proto } from '../../protobuf';
import {
  handleMultipleSendErrors,
  maybeExpandErrors,
} from './handleMultipleSendErrors';
import { ourProfileKeyService } from '../../services/ourProfileKey';
import { wrapWithSyncMessageSend } from '../../util/wrapWithSyncMessageSend';

import type { ConversationModel } from '../../models/conversations';
import type {
  ConversationQueueJobBundle,
  DeleteForEveryoneJobData,
} from '../conversationJobQueue';
import { getUntrustedConversationUuids } from './getUntrustedConversationUuids';
import { handleMessageSend } from '../../util/handleMessageSend';
import { isConversationAccepted } from '../../util/isConversationAccepted';
import { isConversationUnregistered } from '../../util/isConversationUnregistered';
import { getMessageById } from '../../messages/getMessageById';
import { isNotNil } from '../../util/isNotNil';
import type { CallbackResultType } from '../../textsecure/Types.d';
import type { MessageModel } from '../../models/messages';
import { SendMessageProtoError } from '../../textsecure/Errors';
import { strictAssert } from '../../util/assert';
import type { LoggerType } from '../../types/Logging';

export async function sendDeleteForEveryone(
  conversation: ConversationModel,
  {
    isFinalAttempt,
    messaging,
    shouldContinue,
    timestamp,
    timeRemaining,
    log,
  }: ConversationQueueJobBundle,
  data: DeleteForEveryoneJobData
): Promise<void> {
  const {
    messageId,
    recipients: recipientsFromJob,
    revision,
    targetTimestamp,
  } = data;

  const message = await getMessageById(messageId);
  if (!message) {
    log.error(`Failed to fetch message ${messageId}. Failing job.`);
    return;
  }

  if (!shouldContinue) {
    log.info('Ran out of time. Giving up on sending delete for everyone');
    updateMessageWithFailure(message, [new Error('Ran out of time!')], log);
    return;
  }

  const sendType = 'deleteForEveryone';
  const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;
  const contentHint = ContentHint.RESENDABLE;
  const messageIds = [messageId];

  const logId = `deleteForEveryone/${conversation.idForLogging()}`;

  const deletedForEveryoneSendStatus = message.get(
    'deletedForEveryoneSendStatus'
  );
  const recipients = deletedForEveryoneSendStatus
    ? getRecipients(deletedForEveryoneSendStatus)
    : recipientsFromJob;

  const untrustedUuids = getUntrustedConversationUuids(recipients);
  if (untrustedUuids.length) {
    window.reduxActions.conversations.conversationStoppedByMissingVerification({
      conversationId: conversation.id,
      untrustedUuids,
    });
    throw new Error(
      `Delete for everyone blocked because ${untrustedUuids.length} conversation(s) were untrusted. Failing this attempt.`
    );
  }

  await conversation.queueJob(
    'conversationQueue/sendDeleteForEveryone',
    async abortSignal => {
      log.info(
        `Sending deleteForEveryone to conversation ${logId}`,
        `with timestamp ${timestamp}`,
        `for message ${targetTimestamp}`
      );

      let profileKey: Uint8Array | undefined;
      if (conversation.get('profileSharing')) {
        profileKey = await ourProfileKeyService.get();
      }

      const sendOptions = await getSendOptions(conversation.attributes);

      try {
        if (isMe(conversation.attributes)) {
          const proto = await messaging.getContentMessage({
            deletedForEveryoneTimestamp: targetTimestamp,
            profileKey,
            recipients: conversation.getRecipients(),
            timestamp,
          });
          strictAssert(
            proto.dataMessage,
            'ContentMessage must have dataMessage'
          );

          await handleMessageSend(
            messaging.sendSyncMessage({
              encodedDataMessage: Proto.DataMessage.encode(
                proto.dataMessage
              ).finish(),
              destination: conversation.get('e164'),
              destinationUuid: conversation.get('uuid'),
              expirationStartTimestamp: null,
              options: sendOptions,
              timestamp,
              urgent: false,
            }),
            { messageIds, sendType }
          );
          await updateMessageWithSuccessfulSends(message);
        } else if (isDirectConversation(conversation.attributes)) {
          if (!isConversationAccepted(conversation.attributes)) {
            log.info(
              `conversation ${conversation.idForLogging()} is not accepted; refusing to send`
            );
            updateMessageWithFailure(
              message,
              [new Error('Message request was not accepted')],
              log
            );
            return;
          }
          if (isConversationUnregistered(conversation.attributes)) {
            log.info(
              `conversation ${conversation.idForLogging()} is unregistered; refusing to send`
            );
            updateMessageWithFailure(
              message,
              [new Error('Contact no longer has a Signal account')],
              log
            );
            return;
          }
          if (conversation.isBlocked()) {
            log.info(
              `conversation ${conversation.idForLogging()} is blocked; refusing to send`
            );
            updateMessageWithFailure(
              message,
              [new Error('Contact is blocked')],
              log
            );
            return;
          }

          await wrapWithSyncMessageSend({
            conversation,
            logId,
            messageIds,
            send: async sender =>
              sender.sendMessageToIdentifier({
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                identifier: conversation.getSendTarget()!,
                messageText: undefined,
                attachments: [],
                deletedForEveryoneTimestamp: targetTimestamp,
                timestamp,
                expireTimer: undefined,
                contentHint,
                groupId: undefined,
                profileKey,
                options: sendOptions,
                urgent: true,
              }),
            sendType,
            timestamp,
          });

          await updateMessageWithSuccessfulSends(message);
        } else {
          if (isGroupV2(conversation.attributes) && !isNumber(revision)) {
            log.error('No revision provided, but conversation is GroupV2');
          }

          const groupV2Info = conversation.getGroupV2Info({
            members: recipients,
          });
          if (groupV2Info && isNumber(revision)) {
            groupV2Info.revision = revision;
          }

          await wrapWithSyncMessageSend({
            conversation,
            logId,
            messageIds,
            send: async () =>
              window.Signal.Util.sendToGroup({
                abortSignal,
                contentHint,
                groupSendOptions: {
                  groupV1: conversation.getGroupV1Info(recipients),
                  groupV2: groupV2Info,
                  deletedForEveryoneTimestamp: targetTimestamp,
                  timestamp,
                  profileKey,
                },
                messageId,
                sendOptions,
                sendTarget: conversation.toSenderKeyTarget(),
                sendType: 'deleteForEveryone',
                urgent: true,
              }),
            sendType,
            timestamp,
          });

          await updateMessageWithSuccessfulSends(message);
        }
      } catch (error: unknown) {
        if (error instanceof SendMessageProtoError) {
          await updateMessageWithSuccessfulSends(message, error);
        }

        const errors = maybeExpandErrors(error);
        await handleMultipleSendErrors({
          errors,
          isFinalAttempt,
          log,
          markFailed: () => updateMessageWithFailure(message, errors, log),
          timeRemaining,
          toThrow: error,
        });
      }
    }
  );
}

function getRecipients(
  sendStatusByConversationId: Record<string, boolean>
): Array<string> {
  return Object.entries(sendStatusByConversationId)
    .filter(([_, isSent]) => !isSent)
    .map(([conversationId]) => {
      const recipient = window.ConversationController.get(conversationId);
      if (!recipient) {
        return null;
      }
      return recipient.get('uuid');
    })
    .filter(isNotNil);
}

async function updateMessageWithSuccessfulSends(
  message: MessageModel,
  result?: CallbackResultType | SendMessageProtoError
): Promise<void> {
  if (!result) {
    message.set({
      deletedForEveryoneSendStatus: {},
      deletedForEveryoneFailed: undefined,
    });
    await window.Signal.Data.saveMessage(message.attributes, {
      ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
    });

    return;
  }

  const deletedForEveryoneSendStatus = {
    ...message.get('deletedForEveryoneSendStatus'),
  };

  result.successfulIdentifiers?.forEach(identifier => {
    const conversation = window.ConversationController.get(identifier);
    if (!conversation) {
      return;
    }
    deletedForEveryoneSendStatus[conversation.id] = true;
  });

  message.set({
    deletedForEveryoneSendStatus,
    deletedForEveryoneFailed: undefined,
  });
  await window.Signal.Data.saveMessage(message.attributes, {
    ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
  });
}

async function updateMessageWithFailure(
  message: MessageModel,
  errors: ReadonlyArray<unknown>,
  log: LoggerType
): Promise<void> {
  log.error(
    'updateMessageWithFailure: Setting this set of errors',
    errors.map(Errors.toLogFormat)
  );

  message.set({ deletedForEveryoneFailed: true });
  await window.Signal.Data.saveMessage(message.attributes, {
    ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
  });
}
