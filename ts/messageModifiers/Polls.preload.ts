// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString } from '../types/ServiceId.std.js';
import type {
  MessageAttributesType,
  ReadonlyMessageAttributesType,
} from '../model-types.d.ts';
import type { MessagePollVoteType } from '../types/Polls.dom.js';
import { MessageModel } from '../models/messages.preload.js';
import { DataReader } from '../sql/Client.preload.js';
import * as Errors from '../types/errors.std.js';
import { createLogger } from '../logging/log.std.js';
import { isIncoming, isOutgoing } from '../messages/helpers.std.js';
import { getAuthor } from '../messages/sources.preload.js';

import { isSent, SendStatus } from '../messages/MessageSendState.std.js';
import { getPropForTimestamp } from '../util/editHelpers.std.js';
import { isMe } from '../util/whatTypeOfConversation.dom.js';

import { strictAssert } from '../util/assert.std.js';
import { getMessageIdForLogging } from '../util/idForLogging.preload.js';

const log = createLogger('Polls');

export enum PollSource {
  FromThisDevice = 'FromThisDevice',
  FromSync = 'FromSync',
  FromSomeoneElse = 'FromSomeoneElse',
}

export type PollVoteAttributesType = {
  envelopeId: string;
  fromConversationId: string;
  removeFromMessageReceiverCache: () => unknown;
  source: PollSource;
  targetAuthorAci: AciString;
  targetTimestamp: number;
  optionIndexes: ReadonlyArray<number>;
  voteCount: number;
  timestamp: number;
  receivedAtDate: number;
};

export type PollTerminateAttributesType = {
  envelopeId: string;
  fromConversationId: string;
  removeFromMessageReceiverCache: () => unknown;
  source: PollSource;
  targetTimestamp: number;
  timestamp: number;
  receivedAtDate: number;
};

const pollVoteCache = new Map<string, PollVoteAttributesType>();
const pollTerminateCache = new Map<string, PollTerminateAttributesType>();

function removeVote(vote: PollVoteAttributesType): void {
  pollVoteCache.delete(vote.envelopeId);
  vote.removeFromMessageReceiverCache();
}

function removeTerminate(terminate: PollTerminateAttributesType): void {
  pollTerminateCache.delete(terminate.envelopeId);
  terminate.removeFromMessageReceiverCache();
}

function doesVoteModifierMatchMessage({
  message,
  targetTimestamp,
  targetAuthorAci,
  targetAuthorId,
  voteSenderConversationId,
}: {
  message: ReadonlyMessageAttributesType;
  targetTimestamp: number;
  targetAuthorAci?: string;
  targetAuthorId?: string;
  voteSenderConversationId: string;
}): boolean {
  if (message.sent_at !== targetTimestamp) {
    return false;
  }

  const author = getAuthor(message);
  if (!author) {
    return false;
  }

  const targetAuthorConversation = window.ConversationController.get(
    targetAuthorAci ?? targetAuthorId
  );
  if (!targetAuthorConversation) {
    return false;
  }

  if (author.id !== targetAuthorConversation.id) {
    return false;
  }

  const voteSenderConversation = window.ConversationController.get(
    voteSenderConversationId
  );
  if (!voteSenderConversation) {
    return false;
  }

  if (isMe(voteSenderConversation.attributes)) {
    return true;
  }

  if (isOutgoing(message)) {
    const sendStateByConversationId = getPropForTimestamp({
      log,
      message,
      prop: 'sendStateByConversationId',
      targetTimestamp,
    });

    const sendState = sendStateByConversationId?.[voteSenderConversationId];
    return !!sendState && isSent(sendState.status);
  }

  if (isIncoming(message)) {
    const messageConversation = window.ConversationController.get(
      message.conversationId
    );
    if (!messageConversation) {
      return false;
    }

    const voteSenderServiceId = voteSenderConversation.getServiceId();
    return (
      voteSenderServiceId != null &&
      messageConversation.hasMember(voteSenderServiceId)
    );
  }

  return false;
}

async function findPollMessage({
  targetTimestamp,
  targetAuthorAci,
  targetAuthorId,
  voteSenderConversationId,
  logId,
}: {
  targetTimestamp: number;
  targetAuthorAci?: string;
  targetAuthorId?: string;
  voteSenderConversationId: string;
  logId: string;
}): Promise<MessageAttributesType | undefined> {
  const messages = await DataReader.getMessagesBySentAt(targetTimestamp);

  const matchingMessages = messages.filter(message => {
    if (!message.poll) {
      return false;
    }

    return doesVoteModifierMatchMessage({
      message,
      targetTimestamp,
      targetAuthorAci,
      targetAuthorId,
      voteSenderConversationId,
    });
  });

  if (!matchingMessages.length) {
    return undefined;
  }

  if (matchingMessages.length > 1) {
    log.warn(
      `${logId}/findPollMessage: found ${matchingMessages.length} matching messages for the poll!`
    );
  }

  return matchingMessages[0];
}

export async function onPollVote(vote: PollVoteAttributesType): Promise<void> {
  pollVoteCache.set(vote.envelopeId, vote);

  const logId = `Polls.onPollVote(timestamp=${vote.timestamp};target=${vote.targetTimestamp})`;

  try {
    const matchingMessage = await findPollMessage({
      targetTimestamp: vote.targetTimestamp,
      targetAuthorAci: vote.targetAuthorAci,
      voteSenderConversationId: vote.fromConversationId,
      logId,
    });

    if (!matchingMessage) {
      log.info(
        `${logId}: No poll message for vote`,
        'targeting',
        vote.targetAuthorAci
      );
      return;
    }

    const matchingMessageConversation = window.ConversationController.get(
      matchingMessage.conversationId
    );

    if (!matchingMessageConversation) {
      log.info(
        `${logId}: No target conversation for poll vote`,
        vote.targetAuthorAci,
        vote.targetTimestamp
      );
      removeVote(vote);
      return undefined;
    }

    // awaiting is safe since `onPollVote` is never called from inside the queue
    await matchingMessageConversation.queueJob('Polls.onPollVote', async () => {
      log.info(`${logId}: handling`);

      // Message is fetched inside the conversation queue so we have the
      // most recent data
      const targetMessage = await findPollMessage({
        targetTimestamp: vote.targetTimestamp,
        targetAuthorAci: vote.targetAuthorAci,
        voteSenderConversationId: vote.fromConversationId,
        logId: `${logId}/conversationQueue`,
      });

      if (!targetMessage || targetMessage.id !== matchingMessage.id) {
        log.warn(
          `${logId}: message no longer a match for vote! Maybe it's been deleted?`
        );
        removeVote(vote);
        return;
      }

      const targetMessageModel = window.MessageCache.register(
        new MessageModel(targetMessage)
      );

      await handlePollVote(targetMessageModel, vote);
      removeVote(vote);
    });
  } catch (error) {
    removeVote(vote);
    log.error(`${logId} error:`, Errors.toLogFormat(error));
  }
}

export async function onPollTerminate(
  terminate: PollTerminateAttributesType
): Promise<void> {
  pollTerminateCache.set(terminate.envelopeId, terminate);

  const logId = `Polls.onPollTerminate(timestamp=${terminate.timestamp};target=${terminate.targetTimestamp})`;

  try {
    // For termination, we need to find the poll by timestamp only
    // The fromConversationId must be the poll creator
    const matchingMessage = await findPollMessage({
      targetTimestamp: terminate.targetTimestamp,
      targetAuthorId: terminate.fromConversationId,
      voteSenderConversationId: terminate.fromConversationId,
      logId,
    });

    if (!matchingMessage) {
      log.info(
        `${logId}: No poll message for termination`,
        'targeting timestamp',
        terminate.targetTimestamp
      );
      return;
    }

    const matchingMessageConversation = window.ConversationController.get(
      matchingMessage.conversationId
    );

    if (!matchingMessageConversation) {
      log.info(
        `${logId}: No target conversation for poll termination`,
        terminate.targetTimestamp
      );
      removeTerminate(terminate);
      return undefined;
    }

    // awaiting is safe since `onPollTerminate` is never called from inside the queue
    await matchingMessageConversation.queueJob(
      'Polls.onPollTerminate',
      async () => {
        log.info(`${logId}: handling`);

        // Re-fetch to ensure we have the most recent data
        const targetMessages = await DataReader.getMessagesBySentAt(
          terminate.targetTimestamp
        );
        const targetMessage = targetMessages.find(
          msg => msg.id === matchingMessage.id
        );

        if (!targetMessage) {
          log.warn(
            `${logId}: message no longer exists! Maybe it's been deleted?`
          );
          removeTerminate(terminate);
          return;
        }

        const targetMessageModel = window.MessageCache.register(
          new MessageModel(targetMessage)
        );

        await handlePollTerminate(targetMessageModel, terminate);
        removeTerminate(terminate);
      }
    );
  } catch (error) {
    removeTerminate(terminate);
    log.error(`${logId} error:`, Errors.toLogFormat(error));
  }
}

export async function handlePollVote(
  message: MessageModel,
  vote: PollVoteAttributesType,
  {
    shouldPersist = true,
  }: {
    shouldPersist?: boolean;
  } = {}
): Promise<void> {
  if (message.get('deletedForEveryone')) {
    return;
  }

  const poll = message.get('poll');
  if (!poll) {
    log.warn('handlePollVote: Message is not a poll');
    return;
  }

  if (poll.terminatedAt) {
    log.info('handlePollVote: Poll is already terminated, ignoring vote');
    return;
  }

  // Validate option indexes
  const maxOptionIndex = poll.options.length - 1;
  const invalidIndexes = vote.optionIndexes.filter(
    index => index < 0 || index > maxOptionIndex
  );
  if (invalidIndexes.length > 0) {
    log.warn('handlePollVote: Invalid option indexes found, dropping');
    return;
  }

  // Check multiple choice constraint
  if (!poll.allowMultiple && vote.optionIndexes.length > 1) {
    log.warn(
      'handlePollVote: Multiple votes not allowed for this poll, dropping'
    );
    return;
  }

  const conversation = window.ConversationController.get(
    message.attributes.conversationId
  );
  if (!conversation) {
    return;
  }

  const isFromThisDevice = vote.source === PollSource.FromThisDevice;
  const isFromSync = vote.source === PollSource.FromSync;
  const isFromSomeoneElse = vote.source === PollSource.FromSomeoneElse;
  strictAssert(
    isFromThisDevice || isFromSync || isFromSomeoneElse,
    'Vote can only be from this device, from sync, or from someone else'
  );

  const ourConversationId =
    window.ConversationController.getOurConversationIdOrThrow();

  const newVote: MessagePollVoteType = {
    fromConversationId: vote.fromConversationId,
    optionIndexes: vote.optionIndexes,
    voteCount: vote.voteCount,
    timestamp: vote.timestamp,
    sendStateByConversationId: isFromThisDevice
      ? Object.fromEntries(
          Array.from(conversation.getMemberConversationIds())
            .filter(id => id !== ourConversationId)
            .map(id => [
              id,
              { status: SendStatus.Pending, updatedAt: Date.now() },
            ])
        )
      : undefined,
  };

  // Update or add vote with conflict resolution
  const currentVotes: Array<MessagePollVoteType> = poll.votes
    ? [...poll.votes]
    : [];
  let updatedVotes: Array<MessagePollVoteType>;

  if (isFromThisDevice) {
    // For votes from this device: keep sent votes, remove pending votes, add new vote
    // This matches reaction behavior where we can have one sent + one pending
    const pendingVotesFromUs = currentVotes.filter(
      v =>
        v.fromConversationId === vote.fromConversationId &&
        v.sendStateByConversationId != null
    );

    updatedVotes = [
      ...currentVotes.filter(v => !pendingVotesFromUs.includes(v)),
      newVote,
    ];
  } else {
    // For sync/others: use voteCount-based conflict resolution
    const existingVoteIndex = currentVotes.findIndex(
      v => v.fromConversationId === vote.fromConversationId
    );

    if (existingVoteIndex !== -1) {
      const existingVote = currentVotes[existingVoteIndex];

      if (newVote.voteCount > existingVote.voteCount) {
        updatedVotes = [...currentVotes];
        updatedVotes[existingVoteIndex] = newVote;
      } else if (
        isFromSync &&
        newVote.voteCount === existingVote.voteCount &&
        newVote.timestamp > existingVote.timestamp
      ) {
        log.info(
          'handlePollVote: Same voteCount from sync, using timestamp tiebreaker'
        );
        updatedVotes = [...currentVotes];
        updatedVotes[existingVoteIndex] = newVote;
      } else {
        log.info(
          'handlePollVote: Keeping existing vote with higher or same voteCount'
        );
        updatedVotes = currentVotes;
      }
    } else {
      updatedVotes = [...currentVotes, newVote];
    }
  }

  message.set({
    poll: {
      ...poll,
      votes: updatedVotes,
    },
  });

  log.info(
    'handlePollVote:',
    `Done processing vote for poll ${getMessageIdForLogging(message.attributes)}.`
  );

  if (shouldPersist) {
    await window.MessageCache.saveMessage(message.attributes);
    window.reduxActions.conversations.markOpenConversationRead(conversation.id);
  }
}

export async function handlePollTerminate(
  message: MessageModel,
  terminate: PollTerminateAttributesType,
  {
    shouldPersist = true,
  }: {
    shouldPersist?: boolean;
  } = {}
): Promise<void> {
  const { attributes } = message;

  if (message.get('deletedForEveryone')) {
    return;
  }

  const poll = message.get('poll');
  if (!poll) {
    log.warn('handlePollTerminate: Message is not a poll');
    return;
  }

  if (poll.terminatedAt) {
    log.info('handlePollTerminate: Poll is already terminated');
    return;
  }

  const conversation = window.ConversationController.get(
    message.attributes.conversationId
  );
  if (!conversation) {
    return;
  }

  // Verify the terminator is the poll creator
  const author = getAuthor(attributes);
  const terminatorConversation = window.ConversationController.get(
    terminate.fromConversationId
  );

  if (
    !author ||
    !terminatorConversation ||
    author.id !== terminatorConversation.id
  ) {
    log.warn(
      'handlePollTerminate: Termination rejected - not from poll creator'
    );
    return;
  }

  message.set({
    poll: {
      ...poll,
      terminatedAt: terminate.timestamp,
    },
  });

  log.info(
    'handlePollTerminate:',
    `Poll ${getMessageIdForLogging(message.attributes)} terminated at ${terminate.timestamp}`
  );

  if (shouldPersist) {
    await window.MessageCache.saveMessage(message.attributes);
    window.reduxActions.conversations.markOpenConversationRead(conversation.id);
  }
}

export function drainCachedVotesForMessage(
  message: ReadonlyMessageAttributesType
): Array<PollVoteAttributesType> {
  const matching = Array.from(pollVoteCache.values()).filter(vote => {
    if (!message.poll) {
      return false;
    }

    return doesVoteModifierMatchMessage({
      message,
      targetTimestamp: vote.targetTimestamp,
      targetAuthorAci: vote.targetAuthorAci,
      voteSenderConversationId: vote.fromConversationId,
    });
  });

  matching.forEach(vote => removeVote(vote));
  return matching;
}

export function drainCachedTerminatesForMessage(
  message: ReadonlyMessageAttributesType
): Array<PollTerminateAttributesType> {
  const matching = Array.from(pollTerminateCache.values()).filter(term => {
    return message.poll && message.sent_at === term.targetTimestamp;
  });

  matching.forEach(term => removeTerminate(term));
  return matching;
}
