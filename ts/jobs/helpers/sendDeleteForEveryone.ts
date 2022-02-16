// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber } from 'lodash';

import { getSendOptions } from '../../util/getSendOptions';
import {
  isDirectConversation,
  isGroupV2,
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
import { getUntrustedConversationIds } from './getUntrustedConversationIds';

// Note: because we don't have a recipient map, if some sends fail, we will resend this
//   message to folks that got it on the first go-round. This is okay, because a delete
//   for everyone has no effect when applied the second time on a message.
export async function sendDeleteForEveryone(
  conversation: ConversationModel,
  {
    isFinalAttempt,
    shouldContinue,
    timestamp,
    timeRemaining,
    log,
  }: ConversationQueueJobBundle,
  data: DeleteForEveryoneJobData
): Promise<void> {
  if (!shouldContinue) {
    log.info('Ran out of time. Giving up on sending delete for everyone');
    return;
  }

  const { messageId, recipients, revision, targetTimestamp } = data;
  const sendType = 'deleteForEveryone';
  const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;
  const contentHint = ContentHint.RESENDABLE;
  const messageIds = [messageId];

  const logId = `deleteForEveryone/${conversation.idForLogging()}`;

  const untrustedConversationIds = getUntrustedConversationIds(recipients);
  if (untrustedConversationIds.length) {
    window.reduxActions.conversations.conversationStoppedByMissingVerification({
      conversationId: conversation.id,
      untrustedConversationIds,
    });
    throw new Error(
      `Delete for everyone blocked because ${untrustedConversationIds.length} conversation(s) were untrusted. Failing this attempt.`
    );
  }

  await conversation.queueJob(
    'conversationQueue/sendDeleteForEveryone',
    async () => {
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
        if (isDirectConversation(conversation.attributes)) {
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
              }),
            sendType,
            timestamp,
          });
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
  );
}
