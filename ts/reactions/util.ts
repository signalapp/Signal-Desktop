// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import type { MessageReactionType } from '../model-types.d.ts';
import { areObjectEntriesEqual } from '../util/areObjectEntriesEqual.std.js';

const { findLastIndex, has, identity, omit, negate } = lodash;

const isReactionEqual = (
  a: undefined | Readonly<MessageReactionType>,
  b: undefined | Readonly<MessageReactionType>
): boolean =>
  a === b ||
  Boolean(
    a && b && areObjectEntriesEqual(a, b, ['emoji', 'fromId', 'timestamp'])
  );

const isOutgoingReactionFullySent = ({
  isSentByConversationId = {},
}: Readonly<Pick<MessageReactionType, 'isSentByConversationId'>>): boolean =>
  !isSentByConversationId ||
  Object.values(isSentByConversationId).every(identity);

const isOutgoingReactionPending = negate(isOutgoingReactionFullySent);

const isOutgoingReactionCompletelyUnsent = ({
  isSentByConversationId = {},
}: Readonly<Pick<MessageReactionType, 'isSentByConversationId'>>): boolean => {
  const sendStates = Object.values(isSentByConversationId);
  return sendStates.length > 0 && sendStates.every(state => state === false);
};

export function addOutgoingReaction(
  oldReactions: ReadonlyArray<MessageReactionType>,
  newReaction: Readonly<MessageReactionType>
): ReadonlyArray<MessageReactionType> {
  const pendingOutgoingReactions = new Set(
    oldReactions.filter(isOutgoingReactionPending)
  );
  return [
    ...oldReactions.filter(re => !pendingOutgoingReactions.has(re)),
    newReaction,
  ];
}

export function getNewestPendingOutgoingReaction(
  reactions: ReadonlyArray<MessageReactionType>,
  ourConversationId: string
):
  | { pendingReaction?: undefined; emojiToRemove?: undefined }
  | {
      pendingReaction: MessageReactionType;
      emojiToRemove?: string;
    } {
  const ourReactions = reactions
    .filter(({ fromId }) => fromId === ourConversationId)
    .sort((a, b) => a.timestamp - b.timestamp);

  const newestFinishedReactionIndex = findLastIndex(
    ourReactions,
    re => re.emoji && isOutgoingReactionFullySent(re)
  );
  const newestFinishedReaction = ourReactions[newestFinishedReactionIndex];

  const newestPendingReactionIndex = findLastIndex(
    ourReactions,
    isOutgoingReactionPending
  );
  const pendingReaction: undefined | MessageReactionType =
    newestPendingReactionIndex > newestFinishedReactionIndex
      ? ourReactions[newestPendingReactionIndex]
      : undefined;

  return pendingReaction
    ? {
        pendingReaction,
        // This might not be right in some cases. For example, imagine the following
        //   sequence:
        //
        // 1. I send reaction A to Alice and Bob, but it was only delivered to Alice.
        // 2. I send reaction B to Alice and Bob, but it was only delivered to Bob.
        // 3. I remove the reaction.
        //
        // Android and iOS don't care what your previous reaction is. Old Desktop versions
        //   *do* care, so we make our best guess. We should be able to remove this after
        //   Desktop has ignored this field for awhile. See commit
        //   `1dc353f08910389ad8cc5487949e6998e90038e2`.
        emojiToRemove: newestFinishedReaction?.emoji,
      }
    : {};
}

export function* getUnsentConversationIds({
  isSentByConversationId = {},
}: Readonly<
  Pick<MessageReactionType, 'isSentByConversationId'>
>): Iterable<string> {
  for (const [id, isSent] of Object.entries(isSentByConversationId)) {
    if (!isSent) {
      yield id;
    }
  }
}

// This function is used when filtering reactions so that we can limit normal
// messages to a single reactions but allow multiple reactions from the same
// sender for stories.
export function isNewReactionReplacingPrevious(
  reaction: MessageReactionType,
  newReaction: MessageReactionType
): boolean {
  return reaction.fromId === newReaction.fromId;
}

export const markOutgoingReactionFailed = (
  reactions: ReadonlyArray<MessageReactionType>,
  reaction: Readonly<MessageReactionType>
): Array<MessageReactionType> =>
  isOutgoingReactionCompletelyUnsent(reaction) || !reaction.emoji
    ? reactions.filter(re => !isReactionEqual(re, reaction))
    : reactions.map(re =>
        isReactionEqual(re, reaction)
          ? omit(re, ['isSentByConversationId'])
          : re
      );

export const markOutgoingReactionSent = (
  reactions: ReadonlyArray<MessageReactionType>,
  reaction: Readonly<MessageReactionType>,
  conversationIdsSentTo: Iterable<string>
): Array<MessageReactionType> => {
  const result: Array<MessageReactionType> = [];

  const newIsSentByConversationId = {
    ...(reaction.isSentByConversationId || {}),
  };
  for (const id of conversationIdsSentTo) {
    if (has(newIsSentByConversationId, id)) {
      newIsSentByConversationId[id] = true;
    }
  }

  const isFullySent = Object.values(newIsSentByConversationId).every(identity);

  for (const re of reactions) {
    if (!isReactionEqual(re, reaction)) {
      let shouldKeep = true;
      if (
        isFullySent &&
        isNewReactionReplacingPrevious(re, reaction) &&
        re.timestamp <= reaction.timestamp
      ) {
        shouldKeep = false;
      }
      if (shouldKeep) {
        result.push(re);
      }
      continue;
    }

    if (isFullySent) {
      if (re.emoji) {
        result.push(omit(re, ['isSentByConversationId']));
      }
    } else {
      result.push({
        ...re,
        isSentByConversationId: newIsSentByConversationId,
      });
    }
  }

  return result;
};
