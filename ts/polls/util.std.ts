// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { omit } from 'lodash';
import type { MessagePollVoteType } from '../types/Polls.dom.js';
import { isSent } from '../messages/MessageSendState.std.js';
import type { SendStateByConversationId } from '../messages/MessageSendState.std.js';

export function* getUnsentConversationIds(
  pollVote: Readonly<Pick<MessagePollVoteType, 'sendStateByConversationId'>>
): Iterable<string> {
  const { sendStateByConversationId = {} } = pollVote;
  for (const [id, sendState] of Object.entries(sendStateByConversationId)) {
    if (!isSent(sendState.status)) {
      yield id;
    }
  }
}

export function isOutgoingPollVoteCompletelyUnsent(
  pollVote: Readonly<Pick<MessagePollVoteType, 'sendStateByConversationId'>>
): boolean {
  if (!pollVote.sendStateByConversationId) {
    return false;
  }
  return Object.values(pollVote.sendStateByConversationId).every(
    sendState => !isSent(sendState.status)
  );
}

/**
 * Updates the poll vote's sendStateByConversationId based on the ephemeral message's
 * send states after a send attempt.
 *
 * This syncs the full SendState objects (status, updatedAt) from the ephemeral message
 * back to the poll vote in the poll.votes[] array.
 */
export function markOutgoingPollVoteSent(
  allVotes: ReadonlyArray<MessagePollVoteType>,
  targetVote: Readonly<MessagePollVoteType>,
  ephemeralSendStateByConversationId: SendStateByConversationId
): Array<MessagePollVoteType> {
  const result: Array<MessagePollVoteType> = [];

  const mergedSendStateByConversationId: SendStateByConversationId = {
    ...(targetVote.sendStateByConversationId || {}),
    ...ephemeralSendStateByConversationId,
  };

  const isFullySent = Object.values(mergedSendStateByConversationId).every(
    sendState => isSent(sendState.status)
  );

  for (const vote of allVotes) {
    const isTargetVote =
      vote.fromConversationId === targetVote.fromConversationId &&
      vote.voteCount === targetVote.voteCount;

    if (isTargetVote) {
      if (isFullySent) {
        result.push(omit(vote, ['sendStateByConversationId']));
      } else {
        result.push({
          ...vote,
          sendStateByConversationId: mergedSendStateByConversationId,
        });
      }
    } else {
      // Remove older sent votes from same sender when new vote fully sends
      const shouldKeep = !(
        isFullySent &&
        vote.fromConversationId === targetVote.fromConversationId &&
        !vote.sendStateByConversationId && // finished sending so no send state
        vote.voteCount < targetVote.voteCount
      );
      if (shouldKeep) {
        result.push(vote);
      }
    }
  }

  return result;
}

/**
 * Marks a poll vote as failed - removes it if completely unsent, otherwise just
 * removes the send state tracking.
 */
export function markOutgoingPollVoteFailed(
  allVotes: ReadonlyArray<MessagePollVoteType>,
  targetVote: Readonly<MessagePollVoteType>
): Array<MessagePollVoteType> {
  if (isOutgoingPollVoteCompletelyUnsent(targetVote)) {
    // Remove the vote entirely if it was never sent to anyone
    return allVotes.filter(
      candidateVote =>
        candidateVote.fromConversationId !== targetVote.fromConversationId ||
        candidateVote.voteCount !== targetVote.voteCount
    );
  }

  // Otherwise just remove the send state tracking
  return allVotes.map(candidateVote =>
    candidateVote.fromConversationId === targetVote.fromConversationId &&
    candidateVote.voteCount === targetVote.voteCount
      ? omit(candidateVote, ['sendStateByConversationId'])
      : candidateVote
  );
}
