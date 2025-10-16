// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ContentHint } from '@signalapp/libsignal-client';
import lodash from 'lodash';

import * as Errors from '../../types/errors.std.js';
import { getSendOptions } from '../../util/getSendOptions.preload.js';
import {
  isDirectConversation,
  isGroupV2,
  isMe,
} from '../../util/whatTypeOfConversation.dom.js';
import { SignalService as Proto } from '../../protobuf/index.std.js';
import {
  handleMultipleSendErrors,
  maybeExpandErrors,
} from './handleMultipleSendErrors.std.js';
import { ourProfileKeyService } from '../../services/ourProfileKey.std.js';
import { wrapWithSyncMessageSend } from '../../util/wrapWithSyncMessageSend.preload.js';

import type { ConversationModel } from '../../models/conversations.preload.js';
import type {
  ConversationQueueJobBundle,
  DeleteForEveryoneJobData,
} from '../conversationJobQueue.preload.js';
import { getUntrustedConversationServiceIds } from './getUntrustedConversationServiceIds.dom.js';
import { handleMessageSend } from '../../util/handleMessageSend.preload.js';
import { isConversationAccepted } from '../../util/isConversationAccepted.preload.js';
import { isConversationUnregistered } from '../../util/isConversationUnregistered.dom.js';
import { getMessageById } from '../../messages/getMessageById.preload.js';
import { isNotNil } from '../../util/isNotNil.std.js';
import type { CallbackResultType } from '../../textsecure/Types.d.ts';
import type { MessageModel } from '../../models/messages.preload.js';
import { SendMessageProtoError } from '../../textsecure/Errors.std.js';
import { strictAssert } from '../../util/assert.std.js';
import type { LoggerType } from '../../types/Logging.std.js';
import type { ServiceIdString } from '../../types/ServiceId.std.js';
import { isStory } from '../../messages/helpers.std.js';
import { sendToGroup } from '../../util/sendToGroup.preload.js';

const { isNumber } = lodash;

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

  const logId = `sendDeleteForEveryone(${conversation.idForLogging()}, ${messageId})`;

  const message = await getMessageById(messageId);
  if (!message) {
    log.error(`${logId}: Failed to fetch message. Failing job.`);
    return;
  }

  const story = isStory(message.attributes);
  if (story && !isGroupV2(conversation.attributes)) {
    log.error(`${logId}: 1-on-1 Story DOE must use its own job. Failing job`);
    return;
  }

  if (!shouldContinue) {
    log.info(`${logId}: Ran out of time. Giving up on sending`);
    void updateMessageWithFailure(
      message,
      [new Error('Ran out of time!')],
      log
    );
    return;
  }

  const sendType = 'deleteForEveryone';
  const contentHint = ContentHint.Resendable;
  const messageIds = [messageId];

  const deletedForEveryoneSendStatus = message.get(
    'deletedForEveryoneSendStatus'
  );
  const recipients = deletedForEveryoneSendStatus
    ? getRecipients(deletedForEveryoneSendStatus)
    : recipientsFromJob
        .map(recipient => {
          return window.ConversationController.get(recipient)?.getServiceId();
        })
        .filter(isNotNil);

  const untrustedServiceIds = getUntrustedConversationServiceIds(recipients);
  if (untrustedServiceIds.length) {
    window.reduxActions.conversations.conversationStoppedByMissingVerification({
      conversationId: conversation.id,
      untrustedServiceIds,
    });
    throw new Error(
      `Delete for everyone blocked because ${untrustedServiceIds.length} conversation(s) were untrusted. Failing this attempt.`
    );
  }

  await conversation.queueJob(
    'conversationQueue/sendDeleteForEveryone',
    async abortSignal => {
      log.info(
        `${logId}: Sending deleteForEveryone with timestamp ${timestamp}` +
          `for message ${targetTimestamp}, isStory=${story}`
      );

      let profileKey: Uint8Array | undefined;
      if (conversation.get('profileSharing')) {
        profileKey = await ourProfileKeyService.get();
      }

      const sendOptions = await getSendOptions(conversation.attributes, {
        story,
      });

      try {
        if (isMe(conversation.attributes)) {
          const proto = await messaging.getContentMessage({
            deletedForEveryoneTimestamp: targetTimestamp,
            profileKey,
            recipients: conversation.getRecipients(),
            timestamp,
            expireTimerVersion: undefined,
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
              destinationE164: conversation.get('e164'),
              destinationServiceId: conversation.getServiceId(),
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
            void updateMessageWithFailure(
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
            void updateMessageWithFailure(
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
            void updateMessageWithFailure(
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
              sender.sendMessageToServiceId({
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                serviceId: conversation.getSendTarget()!,
                messageText: undefined,
                attachments: [],
                deletedForEveryoneTimestamp: targetTimestamp,
                timestamp,
                expireTimer: undefined,
                expireTimerVersion: undefined,
                contentHint,
                groupId: undefined,
                profileKey,
                options: sendOptions,
                urgent: true,
                story,
                includePniSignatureMessage: true,
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
              sendToGroup({
                abortSignal,
                contentHint,
                groupSendOptions: {
                  groupV2: groupV2Info,
                  deletedForEveryoneTimestamp: targetTimestamp,
                  timestamp,
                  profileKey,
                },
                messageId,
                sendOptions,
                sendTarget: conversation.toSenderKeyTarget(),
                sendType: 'deleteForEveryone',
                story,
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
): Array<ServiceIdString> {
  return Object.entries(sendStatusByConversationId)
    .filter(([_, isSent]) => !isSent)
    .map(([conversationId]) => {
      const recipient = window.ConversationController.get(conversationId);
      if (!recipient) {
        return null;
      }
      if (recipient.isUnregistered()) {
        return null;
      }
      if (recipient.isBlocked()) {
        return null;
      }
      return recipient.getServiceId();
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
    await window.MessageCache.saveMessage(message.attributes);

    return;
  }

  const deletedForEveryoneSendStatus = {
    ...message.get('deletedForEveryoneSendStatus'),
  };

  result.successfulServiceIds?.forEach(serviceId => {
    const conversation = window.ConversationController.get(serviceId);
    if (!conversation) {
      return;
    }
    deletedForEveryoneSendStatus[conversation.id] = true;
  });

  message.set({
    deletedForEveryoneSendStatus,
    deletedForEveryoneFailed: undefined,
  });
  await window.MessageCache.saveMessage(message.attributes);
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
  await window.MessageCache.saveMessage(message.attributes);
}
