// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ContentHint } from '@signalapp/libsignal-client';
import lodash from 'lodash';

import type { ConversationModel } from '../../models/conversations.preload.js';
import type {
  ConversationQueueJobBundle,
  PollTerminateJobData,
} from '../conversationJobQueue.preload.js';
import { PollTerminateSendStatus } from '../../types/Polls.dom.js';
import { wrapWithSyncMessageSend } from '../../util/wrapWithSyncMessageSend.preload.js';
import { sendContentMessageToGroup } from '../../util/sendToGroup.preload.js';
import { getMessageById } from '../../messages/getMessageById.preload.js';
import { ourProfileKeyService } from '../../services/ourProfileKey.std.js';
import { getSendOptions } from '../../util/getSendOptions.preload.js';
import { isGroupV2 } from '../../util/whatTypeOfConversation.dom.js';
import {
  handleMultipleSendErrors,
  maybeExpandErrors,
} from './handleMultipleSendErrors.std.js';
import { getRecipients } from '../../util/getRecipients.dom.js';
import type { MessageModel } from '../../models/messages.preload.js';
import type { LoggerType } from '../../types/Logging.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { DataWriter } from '../../sql/Client.preload.js';
import { cleanupMessages } from '../../util/cleanup.preload.js';

const { isNumber } = lodash;

export async function sendPollTerminate(
  conversation: ConversationModel,
  {
    isFinalAttempt,
    messaging,
    shouldContinue,
    timeRemaining,
    log: jobLog,
  }: ConversationQueueJobBundle,
  data: PollTerminateJobData
): Promise<void> {
  const { pollMessageId, targetTimestamp, revision } = data;

  const logId = `sendPollTerminate(${conversation.idForLogging()}, ${pollMessageId})`;

  const pollMessage = await getMessageById(pollMessageId);
  if (!pollMessage) {
    jobLog.error(`${logId}: Failed to fetch poll message. Failing job.`);
    return;
  }

  const poll = pollMessage.get('poll');
  if (!poll) {
    jobLog.error(`${logId}: Message has no poll object. Failing job.`);
    await markTerminateFailed(pollMessage, jobLog);
    return;
  }

  if (!isGroupV2(conversation.attributes)) {
    jobLog.error(`${logId}: Non-GroupV2 conversation. Failing job.`);
    return;
  }

  if (!shouldContinue) {
    jobLog.info(`${logId}: Ran out of time. Giving up on sending`);
    await markTerminateFailed(pollMessage, jobLog);
    return;
  }

  const recipients = getRecipients(conversation.attributes);

  await conversation.queueJob(
    'conversationQueue/sendPollTerminate',
    async abortSignal => {
      jobLog.info(
        `${logId}: Sending poll terminate for poll timestamp ${targetTimestamp}`
      );

      const profileKey = conversation.get('profileSharing')
        ? await ourProfileKeyService.get()
        : undefined;

      const sendOptions = await getSendOptions(conversation.attributes);

      try {
        if (isGroupV2(conversation.attributes) && !isNumber(revision)) {
          jobLog.error('No revision provided, but conversation is GroupV2');
        }

        const groupV2Info = conversation.getGroupV2Info({
          members: recipients,
        });
        if (groupV2Info && isNumber(revision)) {
          groupV2Info.revision = revision;
        }

        strictAssert(groupV2Info, 'could not get group info from conversation');

        const timestamp = Date.now();
        const expireTimer = conversation.get('expireTimer');

        const contentMessage = await messaging.getPollTerminateContentMessage({
          groupV2: groupV2Info,
          timestamp,
          profileKey,
          expireTimer,
          expireTimerVersion: conversation.getExpireTimerVersion(),
          pollTerminate: {
            targetTimestamp,
          },
        });

        if (abortSignal?.aborted) {
          throw new Error('sendPollTerminate was aborted');
        }

        await wrapWithSyncMessageSend({
          conversation,
          logId,
          messageIds: [pollMessageId],
          send: async () =>
            sendContentMessageToGroup({
              contentHint: ContentHint.Resendable,
              contentMessage,
              messageId: pollMessageId,
              recipients,
              sendOptions,
              sendTarget: conversation.toSenderKeyTarget(),
              sendType: 'pollTerminate',
              timestamp,
              urgent: true,
            }),
          sendType: 'pollTerminate',
          timestamp,
        });

        await markTerminateSuccess(pollMessage, jobLog);
      } catch (error: unknown) {
        const errors = maybeExpandErrors(error);
        await handleMultipleSendErrors({
          errors,
          isFinalAttempt,
          log: jobLog,
          markFailed: () => markTerminateFailed(pollMessage, jobLog),
          timeRemaining,
          toThrow: error,
        });
      }
    }
  );
}

async function markTerminateSuccess(
  message: MessageModel,
  log: LoggerType
): Promise<void> {
  log.info('markTerminateSuccess: Poll terminate sent successfully');
  const poll = message.get('poll');
  if (poll) {
    message.set({
      poll: {
        ...poll,
        terminateSendStatus: PollTerminateSendStatus.Complete,
      },
    });
    await window.MessageCache.saveMessage(message.attributes);
  }
}

async function markTerminateFailed(
  message: MessageModel,
  log: LoggerType
): Promise<void> {
  log.error('markTerminateFailed: Poll terminate send failed');
  const poll = message.get('poll');
  if (!poll) {
    return;
  }

  message.set({
    poll: {
      ...poll,
      terminatedAt: undefined,
      terminateSendStatus: PollTerminateSendStatus.Failed,
    },
  });
  await window.MessageCache.saveMessage(message.attributes);

  // Delete the poll-terminate chat event from timeline
  if (poll.terminatedAt) {
    const notificationMessage = await window.MessageCache.findBySentAt(
      poll.terminatedAt,
      m =>
        m.get('type') === 'poll-terminate' &&
        m.get('pollTerminateNotification')?.pollMessageId === message.id
    );

    if (notificationMessage) {
      log.info('markTerminateFailed: Deleting poll-terminate notification');
      await DataWriter.removeMessage(notificationMessage.id, {
        cleanupMessages,
      });
    }
  }
}
