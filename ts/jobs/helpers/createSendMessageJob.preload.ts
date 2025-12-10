// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ContentHint } from '@signalapp/libsignal-client';
import type { ConversationModel } from '../../models/conversations.preload.js';
import { getSendOptions } from '../../util/getSendOptions.preload.js';
import { sendToGroup } from '../../util/sendToGroup.preload.js';
import {
  isDirectConversation,
  isGroupV2,
} from '../../util/whatTypeOfConversation.dom.js';
import type { ConversationQueueJobBundle } from '../conversationJobQueue.preload.js';
import { getSendRecipientLists } from './getSendRecipientLists.dom.js';
import type { SendTypesType } from '../../util/handleMessageSend.preload.js';
import { handleMessageSend } from '../../util/handleMessageSend.preload.js';
import type { SharedMessageOptionsType } from '../../textsecure/SendMessage.preload.js';
import { strictAssert } from '../../util/assert.std.js';
import { wrapWithSyncMessageSend } from '../../util/wrapWithSyncMessageSend.preload.js';
import {
  handleMultipleSendErrors,
  maybeExpandErrors,
} from './handleMultipleSendErrors.std.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

export type SendMessageJobOptions<Data> = Readonly<{
  sendName: string; // ex: 'sendExampleMessage'
  sendType: SendTypesType;
  getMessageId: (data: Data) => string | null;
  getMessageOptions: (
    data: Data,
    jobTimestamp: number
  ) => Omit<SharedMessageOptionsType, 'recipients'>;
}>;

export function createSendMessageJob<Data>(
  options: SendMessageJobOptions<Data>
) {
  return async function sendMessage(
    conversation: ConversationModel,
    job: ConversationQueueJobBundle,
    data: Data
  ): Promise<void> {
    const { sendName, sendType, getMessageId, getMessageOptions } = options;

    const logId = `${sendName}(${conversation.idForLogging()}/${job.timestamp})`;
    const log = job.log.child(logId);

    if (!job.shouldContinue) {
      log.info('Ran out of time, cancelling send');
      return;
    }

    const { recipientServiceIdsWithoutMe, untrustedServiceIds } =
      getSendRecipientLists({
        log,
        conversation,
        conversationIds: Array.from(conversation.getMemberConversationIds()),
      });

    if (untrustedServiceIds.length > 0) {
      window.reduxActions.conversations.conversationStoppedByMissingVerification(
        {
          conversationId: conversation.id,
          untrustedServiceIds,
        }
      );
      throw new Error(
        `${sendType} blocked because ${untrustedServiceIds.length} ` +
          'conversation(s) were untrusted. Failing this attempt.'
      );
    }

    const messageId = getMessageId(data);
    const messageOptions = getMessageOptions(data, job.timestamp);

    try {
      if (recipientServiceIdsWithoutMe.length === 0) {
        const sendOptions = await getSendOptions(conversation.attributes, {
          syncMessage: true,
        });
        // Only sending a sync to ourselves
        await conversation.queueJob(
          `conversationQueue/${sendName}/sync`,
          async () => {
            const ourAci = itemStorage.user.getCheckedAci();
            const encodedDataMessage = await job.messaging.getDataOrEditMessage(
              {
                ...messageOptions,
                recipients: [ourAci],
              }
            );

            return handleMessageSend(
              job.messaging.sendSyncMessage({
                encodedDataMessage,
                timestamp: job.timestamp,
                destinationE164: conversation.get('e164'),
                destinationServiceId: conversation.getServiceId(),
                expirationStartTimestamp: null,
                isUpdate: false,
                options: sendOptions,
                urgent: false,
              }),
              {
                messageIds: messageId != null ? [messageId] : [],
                sendType,
              }
            );
          }
        );
      } else if (isDirectConversation(conversation.attributes)) {
        const recipientServiceId = recipientServiceIdsWithoutMe.at(0);

        if (recipientServiceId == null) {
          log.info('Recipient was dropped');
          return;
        }

        const sendOptions = await getSendOptions(conversation.attributes);

        await conversation.queueJob(
          `conversationQueue/${sendName}/direct`,
          () => {
            return wrapWithSyncMessageSend({
              conversation,
              logId,
              messageIds: messageId != null ? [messageId] : [],
              send: sender => {
                return sender.sendMessageToServiceId({
                  serviceId: recipientServiceId,
                  messageOptions: getMessageOptions(data, job.timestamp),
                  groupId: undefined,
                  contentHint: ContentHint.Resendable,
                  options: sendOptions,
                  urgent: true,
                  includePniSignatureMessage: true,
                });
              },
              sendType,
              timestamp: job.timestamp,
            });
          }
        );
      } else if (isGroupV2(conversation.attributes)) {
        const sendOptions = await getSendOptions(conversation.attributes, {
          groupId: conversation.get('groupId'),
        });
        const groupV2Info = conversation.getGroupV2Info({
          members: recipientServiceIdsWithoutMe,
        });
        strictAssert(groupV2Info, 'Missing groupV2Info');

        await conversation.queueJob(
          `conversationQueue/${sendName}/group`,
          abortSignal => {
            return wrapWithSyncMessageSend({
              conversation,
              logId,
              messageIds: messageId != null ? [messageId] : [],
              send: () => {
                return sendToGroup({
                  abortSignal,
                  contentHint: ContentHint.Resendable,
                  groupSendOptions: {
                    groupV2: groupV2Info,
                    ...getMessageOptions(data, job.timestamp),
                  },
                  messageId: messageId ?? undefined,
                  sendOptions,
                  sendTarget: conversation.toSenderKeyTarget(),
                  sendType,
                  urgent: true,
                });
              },
              sendType,
              timestamp: job.timestamp,
            });
          }
        );
      } else {
        throw new Error('Unexpected conversation type');
      }
    } catch (error) {
      const errors = maybeExpandErrors(error);
      await handleMultipleSendErrors({
        errors,
        isFinalAttempt: job.isFinalAttempt,
        log,
        timeRemaining: job.timeRemaining,
        toThrow: error,
      });
    }
  };
}
