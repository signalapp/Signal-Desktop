// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ContentHint } from '@signalapp/libsignal-client';
import * as Errors from '../../types/errors.std.js';
import { isGroupV2, isMe } from '../../util/whatTypeOfConversation.dom.js';
import { getSendOptions } from '../../util/getSendOptions.preload.js';
import { handleMessageSend } from '../../util/handleMessageSend.preload.js';
import { sendContentMessageToGroup } from '../../util/sendToGroup.preload.js';
import { MessageModel } from '../../models/messages.preload.js';
import { generateMessageId } from '../../util/generateMessageId.node.js';
import { incrementMessageCounter } from '../../util/incrementMessageCounter.preload.js';
import { ourProfileKeyService } from '../../services/ourProfileKey.std.js';
import { send, sendSyncMessageOnly } from '../../messages/send.preload.js';
import { handleMultipleSendErrors } from './handleMultipleSendErrors.std.js';
import { getMessageById } from '../../messages/getMessageById.preload.js';
import {
  isSent,
  SendStatus,
  type SendStateByConversationId,
} from '../../messages/MessageSendState.std.js';
import type { ServiceIdString } from '../../types/ServiceId.std.js';
import type { LoggerType } from '../../types/Logging.std.js';
import type { MessagePollVoteType } from '../../types/Polls.dom.js';
import type { ConversationModel } from '../../models/conversations.preload.js';
import type {
  ConversationQueueJobBundle,
  PollVoteJobData,
} from '../conversationJobQueue.preload.js';
import * as pollVoteUtil from '../../polls/util.std.js';
import { strictAssert } from '../../util/assert.std.js';

export async function sendPollVote(
  conversation: ConversationModel,
  {
    isFinalAttempt,
    messaging,
    shouldContinue,
    timeRemaining,
    log: jobLog,
  }: ConversationQueueJobBundle,
  data: PollVoteJobData
): Promise<void> {
  const { pollMessageId, revision } = data;

  await window.ConversationController.load();

  const pollMessage = await getMessageById(pollMessageId);
  if (!pollMessage) {
    jobLog.info(
      `poll message ${pollMessageId} was not found, maybe because it was deleted. Giving up on sending poll vote`
    );
    return;
  }

  if (!isGroupV2(conversation.attributes)) {
    jobLog.error('sendPollVote: Non-group conversation; aborting');
    return;
  }
  let sendErrors: Array<Error> = [];
  const saveErrors = (errors: Array<Error>): void => {
    sendErrors = errors;
  };

  let originalError: Error | undefined;
  let pendingVote: MessagePollVoteType | undefined;

  try {
    const pollMessageConversation = window.ConversationController.get(
      pollMessage.get('conversationId')
    );
    if (pollMessageConversation !== conversation) {
      jobLog.error(
        `poll message conversation '${pollMessageConversation?.idForLogging()}' does not match job conversation ${conversation.idForLogging()}`
      );
      return;
    }

    // Find our pending vote
    const ourConversationId =
      window.ConversationController.getOurConversationIdOrThrow();
    const pollDataOnMessage = pollMessage.get('poll');
    if (!pollDataOnMessage) {
      jobLog.error('sendPollVote: poll message has no poll data');
      return;
    }

    pendingVote = pollDataOnMessage.votes?.find(
      vote =>
        vote.fromConversationId === ourConversationId &&
        vote.sendStateByConversationId != null
    );

    if (!pendingVote) {
      jobLog.info('sendPollVote: no pending vote found, nothing to send');
      return;
    }

    const currentPendingVote = pendingVote;

    if (!shouldContinue) {
      jobLog.info('sendPollVote: ran out of time; giving up');
      const pollField = pollMessage.get('poll');
      if (pollField?.votes) {
        const updatedVotes = pollVoteUtil.markOutgoingPollVoteFailed(
          pollField.votes,
          currentPendingVote
        );
        pollMessage.set({
          poll: {
            ...pollField,
            votes: updatedVotes,
          },
        });
      }
      await window.MessageCache.saveMessage(pollMessage.attributes);
      return;
    }

    // Use current vote data, not stale job data
    const currentVoteCount = currentPendingVote.voteCount;
    const currentOptionIndexes = [...currentPendingVote.optionIndexes];
    const currentTimestamp = currentPendingVote.timestamp;

    const { recipientServiceIdsWithoutMe, untrustedServiceIds } = getRecipients(
      jobLog,
      currentPendingVote,
      conversation
    );

    if (untrustedServiceIds.length) {
      window.reduxActions.conversations.conversationStoppedByMissingVerification(
        {
          conversationId: conversation.id,
          untrustedServiceIds,
        }
      );
      throw new Error(
        `Poll vote for message ${pollMessageId} sending blocked because ${untrustedServiceIds.length} conversation(s) were untrusted. Failing this attempt.`
      );
    }

    const expireTimer = pollMessageConversation.get('expireTimer');
    const profileKey = conversation.get('profileSharing')
      ? await ourProfileKeyService.get()
      : undefined;

    const unsentConversationIds = Array.from(
      pollVoteUtil.getUnsentConversationIds(currentPendingVote)
    );
    const ephemeral = new MessageModel({
      ...generateMessageId(incrementMessageCounter()),
      type: 'outgoing',
      conversationId: conversation.id,
      sent_at: currentTimestamp,
      received_at_ms: currentTimestamp,
      timestamp: currentTimestamp,
      sendStateByConversationId: Object.fromEntries(
        unsentConversationIds.map(id => [
          id,
          {
            status: SendStatus.Pending,
            updatedAt: Date.now(),
          },
        ])
      ),
    });
    ephemeral.doNotSave = true;
    window.MessageCache.register(ephemeral);

    let didFullySend: boolean;
    let ephemeralSendStateByConversationId: SendStateByConversationId = {};

    if (recipientServiceIdsWithoutMe.length === 0) {
      jobLog.info('sending sync poll vote message only');
      const groupV2Info = conversation.getGroupV2Info({
        members: recipientServiceIdsWithoutMe,
      });
      if (!groupV2Info) {
        jobLog.error(
          'sendPollVote: Missing groupV2Info for group conversation'
        );
        return;
      }

      const dataMessage = await messaging.getPollVoteDataMessage({
        expireTimer,
        expireTimerVersion: conversation.getExpireTimerVersion(),
        groupV2: groupV2Info,
        profileKey,
        pollVote: {
          targetAuthorAci: data.targetAuthorAci,
          targetTimestamp: data.targetTimestamp,
          optionIndexes: currentOptionIndexes,
          voteCount: currentVoteCount,
        },
        timestamp: currentTimestamp,
      });

      await sendSyncMessageOnly(ephemeral, {
        dataMessage,
        saveErrors,
        targetTimestamp: currentTimestamp,
      });

      didFullySend = true;
    } else {
      const sendOptions = await getSendOptions(conversation.attributes);

      const promise = conversation.queueJob(
        'conversationQueue/sendPollVote',
        async abortSignal => {
          const groupV2Info = conversation.getGroupV2Info({
            members: recipientServiceIdsWithoutMe,
          });
          if (groupV2Info && revision != null) {
            groupV2Info.revision = revision;
          }

          strictAssert(
            groupV2Info,
            'could not get group info from conversation'
          );

          const contentMessage = await messaging.getPollVoteContentMessage({
            groupV2: groupV2Info,
            timestamp: currentTimestamp,
            profileKey,
            expireTimer,
            expireTimerVersion: conversation.getExpireTimerVersion(),
            pollVote: {
              targetAuthorAci: data.targetAuthorAci,
              targetTimestamp: data.targetTimestamp,
              optionIndexes: currentOptionIndexes,
              voteCount: currentVoteCount,
            },
          });

          if (abortSignal?.aborted) {
            throw new Error('sendPollVote was aborted');
          }

          return sendContentMessageToGroup({
            contentHint: ContentHint.Resendable,
            contentMessage,
            messageId: pollMessageId,
            recipients: recipientServiceIdsWithoutMe,
            sendOptions,
            sendTarget: conversation.toSenderKeyTarget(),
            sendType: 'pollVote',
            timestamp: currentTimestamp,
            urgent: true,
          });
        }
      );

      await send(ephemeral, {
        promise: handleMessageSend(promise, {
          messageIds: [pollMessageId],
          sendType: 'pollVote',
        }),
        saveErrors,
        targetTimestamp: currentTimestamp,
      });

      // Await the inner promise to get SendMessageProtoError for upstream processors
      try {
        await promise;
      } catch (error) {
        if (error instanceof Error) {
          originalError = error;
        } else {
          jobLog.error(
            `promise threw something other than an error: ${Errors.toLogFormat(
              error
            )}`
          );
        }
      }

      // Check if the send fully succeeded
      ephemeralSendStateByConversationId =
        ephemeral.get('sendStateByConversationId') || {};

      didFullySend = Object.values(ephemeralSendStateByConversationId).every(
        sendState => isSent(sendState.status)
      );
    }

    // Sync the ephemeral's send states back to the poll vote
    const updatedPoll = pollMessage.get('poll');
    if (updatedPoll?.votes) {
      const updatedVotes = pollVoteUtil.markOutgoingPollVoteSent(
        updatedPoll.votes,
        currentPendingVote,
        ephemeralSendStateByConversationId
      );
      pollMessage.set({
        poll: {
          ...updatedPoll,
          votes: updatedVotes,
        },
      });
    }

    if (!didFullySend) {
      throw new Error('poll vote did not fully send');
    }
  } catch (thrownError: unknown) {
    await handleMultipleSendErrors({
      errors: [thrownError, ...sendErrors],
      isFinalAttempt,
      log: jobLog,
      markFailed: () => {
        jobLog.info('poll vote send failed');
        const updatedPoll = pollMessage.get('poll');
        if (updatedPoll?.votes && pendingVote) {
          const updatedVotes = pollVoteUtil.markOutgoingPollVoteFailed(
            updatedPoll.votes,
            pendingVote
          );
          pollMessage.set({
            poll: {
              ...updatedPoll,
              votes: updatedVotes,
            },
          });
        }
      },
      timeRemaining,
      toThrow: originalError || thrownError,
    });
  } finally {
    await window.MessageCache.saveMessage(pollMessage.attributes);
  }
}

function getRecipients(
  log: LoggerType,
  pendingVote: MessagePollVoteType,
  conversation: ConversationModel
): {
  allRecipientServiceIds: Array<ServiceIdString>;
  recipientServiceIdsWithoutMe: Array<ServiceIdString>;
  untrustedServiceIds: Array<ServiceIdString>;
} {
  const allRecipientServiceIds: Array<ServiceIdString> = [];
  const recipientServiceIdsWithoutMe: Array<ServiceIdString> = [];
  const untrustedServiceIds: Array<ServiceIdString> = [];

  const currentConversationRecipients = conversation.getMemberConversationIds();

  // Only send to recipients who haven't received this vote yet
  for (const conversationId of pollVoteUtil.getUnsentConversationIds(
    pendingVote
  )) {
    const recipient = window.ConversationController.get(conversationId);
    if (!recipient) {
      continue;
    }

    const recipientIdentifier = recipient.getSendTarget();
    const isRecipientMe = isMe(recipient.attributes);

    if (
      !recipientIdentifier ||
      (!currentConversationRecipients.has(conversationId) && !isRecipientMe)
    ) {
      continue;
    }

    if (recipient.isUntrusted()) {
      const serviceId = recipient.getServiceId();
      if (!serviceId) {
        log.error(
          `sendPollVote/getRecipients: Recipient ${recipient.idForLogging()} is untrusted but has no serviceId`
        );
        continue;
      }
      untrustedServiceIds.push(serviceId);
      continue;
    }

    if (recipient.isUnregistered()) {
      continue;
    }

    if (recipient.isBlocked()) {
      continue;
    }

    allRecipientServiceIds.push(recipientIdentifier);
    if (!isRecipientMe) {
      recipientServiceIdsWithoutMe.push(recipientIdentifier);
    }
  }

  return {
    allRecipientServiceIds,
    recipientServiceIdsWithoutMe,
    untrustedServiceIds,
  };
}
