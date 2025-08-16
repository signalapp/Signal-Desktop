// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as Errors from '../../types/errors';
import { getSendOptions } from '../../util/getSendOptions';
import { isDirectConversation, isMe } from '../../util/whatTypeOfConversation';
import { SignalService as Proto } from '../../protobuf';
import {
  handleMultipleSendErrors,
  maybeExpandErrors,
} from './handleMultipleSendErrors';
import { ourProfileKeyService } from '../../services/ourProfileKey';

import type { ConversationModel } from '../../models/conversations';
import type {
  ConversationQueueJobBundle,
  DeleteStoryForEveryoneJobData,
} from '../conversationJobQueue';
import { getUntrustedConversationServiceIds } from './getUntrustedConversationServiceIds';
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
import { isStory } from '../../messages/helpers';

export async function sendDeleteStoryForEveryone(
  ourConversation: ConversationModel,
  {
    isFinalAttempt,
    messaging,
    shouldContinue,
    timestamp,
    timeRemaining,
    log,
  }: ConversationQueueJobBundle,
  data: DeleteStoryForEveryoneJobData
): Promise<void> {
  const { storyId, targetTimestamp, updatedStoryRecipients } = data;

  const logId = `sendDeleteStoryForEveryone(${storyId})`;

  const message = await getMessageById(storyId);
  if (!message) {
    log.error(`${logId}: Failed to fetch message. Failing job.`);
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

  strictAssert(
    isMe(ourConversation.attributes),
    'Story DOE must be sent on our conversaton'
  );
  strictAssert(isStory(message.attributes), 'Story message must be a story');

  const sendType = 'deleteForEveryone';
  const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;
  const contentHint = ContentHint.RESENDABLE;

  const deletedForEveryoneSendStatus = message.get(
    'deletedForEveryoneSendStatus'
  );
  strictAssert(
    deletedForEveryoneSendStatus,
    `${logId}: message does not have deletedForEveryoneSendStatus`
  );
  const recipientIds = Object.entries(deletedForEveryoneSendStatus)
    .filter(([_, isSent]) => !isSent)
    .map(([conversationId]) => conversationId);

  const untrustedServiceIds = getUntrustedConversationServiceIds(recipientIds);
  if (untrustedServiceIds.length) {
    window.reduxActions.conversations.conversationStoppedByMissingVerification({
      conversationId: ourConversation.id,
      untrustedServiceIds,
    });
    throw new Error(
      `Delete for everyone blocked because ${untrustedServiceIds.length} ` +
        'conversation(s) were untrusted. Failing this attempt.'
    );
  }

  const recipientConversations = recipientIds
    .map(conversationId => {
      const conversation = window.ConversationController.get(conversationId);
      if (!conversation) {
        log.error(`${logId}: conversation not found for ${conversationId}`);
        return undefined;
      }
      if (!isDirectConversation(conversation.attributes)) {
        log.error(`${logId}: conversation ${conversationId} is not direct`);
        return undefined;
      }

      if (!isConversationAccepted(conversation.attributes)) {
        log.info(
          `${logId}: conversation ${conversation.idForLogging()} ` +
            'is not accepted; refusing to send'
        );
        void updateMessageWithFailure(
          message,
          [new Error('Message request was not accepted')],
          log
        );
        return undefined;
      }
      if (isConversationUnregistered(conversation.attributes)) {
        log.info(
          `${logId}: conversation ${conversation.idForLogging()} ` +
            'is unregistered; refusing to send'
        );
        void updateMessageWithFailure(
          message,
          [new Error('Contact no longer has a Signal account')],
          log
        );
        return undefined;
      }
      if (conversation.isBlocked()) {
        log.info(
          `${logId}: conversation ${conversation.idForLogging()} ` +
            'is blocked; refusing to send'
        );
        void updateMessageWithFailure(
          message,
          [new Error('Contact is blocked')],
          log
        );
        return undefined;
      }

      return conversation;
    })
    .filter(isNotNil);

  const hadSuccessfulSends = doesMessageHaveSuccessfulSends(message);
  let didSuccessfullySendOne = false;

  // Special case - we have no one to send it to so just send the sync message.
  if (recipientConversations.length === 0) {
    didSuccessfullySendOne = true;
  }

  const profileKey = await ourProfileKeyService.get();

  await Promise.all(
    recipientConversations.map(conversation => {
      return conversation.queueJob(
        'conversationQueue/sendStoryDeleteForEveryone',
        async () => {
          log.info(
            `${logId}: Sending deleteStoryForEveryone with timestamp ${timestamp}`
          );

          const sendOptions = await getSendOptions(conversation.attributes, {
            story: true,
          });

          try {
            const serviceId = conversation.getSendTarget();
            strictAssert(serviceId, 'conversation has no service id');

            await handleMessageSend(
              messaging.sendMessageToServiceId({
                serviceId,
                messageText: undefined,
                attachments: [],
                deletedForEveryoneTimestamp: targetTimestamp,
                timestamp,
                expireTimer: undefined,
                expireTimerVersion: undefined,
                contentHint,
                groupId: undefined,
                profileKey: conversation.get('profileSharing')
                  ? profileKey
                  : undefined,
                options: sendOptions,
                urgent: true,
                story: true,
              }),
              {
                messageIds: [storyId],
                sendType,
              }
            );

            didSuccessfullySendOne = true;

            await updateMessageWithSuccessfulSends(message, {
              dataMessage: undefined,
              editMessage: undefined,
              successfulServiceIds: [serviceId],
            });
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
    })
  );

  // Send sync message exactly once per job. If any of the sends are successful
  // and we didn't send the DOE itself before - it is a good time to send the
  // sync message.
  if (!hadSuccessfulSends && didSuccessfullySendOne) {
    log.info(`${logId}: Sending sync message`);
    const options = await getSendOptions(ourConversation.attributes, {
      syncMessage: true,
    });

    const destinationServiceId = ourConversation.getCheckedServiceId(
      'deleteStoryForEveryone'
    );

    // Sync message for other devices
    await handleMessageSend(
      messaging.sendSyncMessage({
        destinationE164: undefined,
        destinationServiceId,
        storyMessageRecipients: updatedStoryRecipients?.map(
          ({ destinationServiceId: legacyDestinationUuid, ...rest }) => {
            return {
              // The field was renamed.
              legacyDestinationUuid,
              ...rest,
            };
          }
        ),
        expirationStartTimestamp: null,
        isUpdate: true,
        options,
        timestamp: message.get('timestamp'),
        urgent: false,
      }),
      { messageIds: [storyId], sendType }
    );
  }
}

function doesMessageHaveSuccessfulSends(message: MessageModel): boolean {
  const map = message.get('deletedForEveryoneSendStatus') ?? {};

  return Object.values(map).some(value => value === true);
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
