// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ContentHint } from '@signalapp/libsignal-client';
import lodash from 'lodash';

import * as Errors from '../../types/errors.std.ts';
import { getSendOptions } from '../../util/getSendOptions.preload.ts';
import {
  isDirectConversation,
  isGroupV2,
  isMe,
} from '../../util/whatTypeOfConversation.dom.ts';
import { SignalService as Proto } from '../../protobuf/index.std.ts';
import {
  handleMultipleSendErrors,
  maybeExpandErrors,
} from './handleMultipleSendErrors.std.ts';
import { ourProfileKeyService } from '../../services/ourProfileKey.std.ts';
import { wrapWithSyncMessageSend } from '../../util/wrapWithSyncMessageSend.preload.ts';

import type { ConversationModel } from '../../models/conversations.preload.ts';
import type {
  ConversationQueueJobBundle,
  DeleteForEveryoneJobData,
} from '../conversationJobQueue.preload.ts';
import { getUntrustedConversationServiceIds } from './getUntrustedConversationServiceIds.dom.ts';
import { handleMessageSend } from '../../util/handleMessageSend.preload.ts';
import { getMessageById } from '../../messages/getMessageById.preload.ts';
import { isNotNil } from '../../util/isNotNil.std.ts';
import type { CallbackResultType } from '../../textsecure/Types.d.ts';
import type { MessageModel } from '../../models/messages.preload.ts';
import { SendMessageProtoError } from '../../textsecure/Errors.std.ts';
import { strictAssert } from '../../util/assert.std.ts';
import type { LoggerType } from '../../types/Logging.std.ts';
import type { ServiceIdString } from '../../types/ServiceId.std.ts';
import { isStory } from '../../messages/helpers.std.ts';
import { sendToGroup } from '../../util/sendToGroup.preload.ts';
import { getMessageSentTimestamp } from '../../util/getMessageSentTimestamp.std.ts';
import { getSourceServiceId } from '../../messages/sources.preload.ts';
import { isAciString } from '../../util/isAciString.std.ts';
import type { SendDeleteForEveryoneType } from '../../textsecure/SendMessage.preload.ts';
import { shouldSendToDirectConversation } from './shouldSendToConversation.preload.ts';

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
    isAdminDelete,
    targetMessageId,
    recipients: recipientsFromJob,
    revision,
  } = data;

  const logId = `sendDeleteForEveryone(${conversation.idForLogging()}, ${targetMessageId}, isAdminDelete=${isAdminDelete})`;

  const message = await getMessageById(targetMessageId);
  if (!message) {
    log.error(`${logId}: Failed to fetch message. Failing job.`);
    return;
  }

  const targetTimestamp = getMessageSentTimestamp(message.attributes, { log });

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
  const messageIds = [targetMessageId];

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

  // Build the delete for everyone options
  const targetAuthorServiceId = getSourceServiceId(message.attributes);
  strictAssert(
    targetAuthorServiceId != null && isAciString(targetAuthorServiceId),
    `${logId}: Could not get target author ACI`
  );

  const deleteForEveryone: SendDeleteForEveryoneType = {
    isAdminDelete,
    targetSentTimestamp: targetTimestamp,
    targetAuthorAci: targetAuthorServiceId,
  };

  await conversation.queueJob(
    'conversationQueue/sendDeleteForEveryone',
    async abortSignal => {
      log.info(
        `${logId}: Sending deleteForEveryone with timestamp ${timestamp}` +
          ` for message ${targetTimestamp}, isStory=${story}`
      );

      let profileKey: Uint8Array<ArrayBuffer> | undefined;
      if (conversation.get('profileSharing')) {
        profileKey = await ourProfileKeyService.get();
      }

      const sendOptions = await getSendOptions(conversation.attributes, {
        story,
      });

      try {
        if (isMe(conversation.attributes)) {
          if (!window.ConversationController.doWeHaveOtherDevices()) {
            log.info(`${logId}: We have no other devices; not sending sync`);
            return;
          }

          const proto = await messaging.getContentMessage({
            deleteForEveryone,
            profileKey,
            recipients: conversation.getRecipients(),
            timestamp,
            expireTimerVersion: undefined,
          });
          strictAssert(
            proto.content?.dataMessage,
            'ContentMessage must have dataMessage'
          );

          await handleMessageSend(
            messaging.sendSyncMessage({
              encodedDataMessage: Proto.DataMessage.encode(
                proto.content.dataMessage
              ),
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
          const [ok, refusal] = shouldSendToDirectConversation(conversation);
          if (!ok) {
            log.info(refusal.logLine);
            void updateMessageWithFailure(message, [refusal.error], log);
            return;
          }

          await wrapWithSyncMessageSend({
            conversation,
            logId,
            messageIds,
            send: async sender =>
              sender.sendMessageToServiceId({
                // oxlint-disable-next-line typescript/no-non-null-assertion
                serviceId: conversation.getSendTarget()!,
                messageOptions: {
                  deleteForEveryone,
                  timestamp,
                  profileKey,
                },
                contentHint,
                groupId: undefined,
                options: sendOptions,
                urgent: true,
                story,
                includePniSignatureMessage: true,
              }),
            sendType,
            timestamp,
            expirationStartTimestamp: null,
          });

          await updateMessageWithSuccessfulSends(message);
        } else {
          if (isGroupV2(conversation.attributes) && !isNumber(revision)) {
            log.error('No revision provided, but conversation is GroupV2');
          }

          const groupV2Info = conversation.getGroupV2Info({
            members: recipients,
          });
          strictAssert(groupV2Info, 'Missing groupV2Info');
          if (isNumber(revision)) {
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
                  deleteForEveryone,
                  timestamp,
                  profileKey,
                },
                messageId: targetMessageId,
                sendOptions,
                sendTarget: conversation.toSenderKeyTarget(),
                sendType: 'deleteForEveryone',
                story,
                urgent: true,
              }),
            sendType,
            timestamp,
            expirationStartTimestamp: null,
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
