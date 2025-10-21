// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v7 as generateUuid } from 'uuid';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../jobs/conversationJobQueue.preload.js';
import { getMessageById } from '../messages/getMessageById.preload.js';
import {
  handlePollVote,
  PollSource,
} from '../messageModifiers/Polls.preload.js';
import type { PollVoteAttributesType } from '../messageModifiers/Polls.preload.js';
import { getMessageSentTimestamp } from '../util/getMessageSentTimestamp.std.js';
import { getSourceServiceId } from '../messages/sources.preload.js';
import { isAciString } from '../util/isAciString.std.js';
import { isGroup } from '../util/whatTypeOfConversation.dom.js';
import { strictAssert } from '../util/assert.std.js';
import { createLogger } from '../logging/log.std.js';

const log = createLogger('enqueuePollVoteForSend');

export async function enqueuePollVoteForSend({
  messageId,
  optionIndexes,
}: Readonly<{
  messageId: string;
  optionIndexes: ReadonlyArray<number>;
}>): Promise<void> {
  const message = await getMessageById(messageId);
  strictAssert(message, 'enqueuePollVoteForSend: no message found');

  const conversation = window.ConversationController.get(
    message.get('conversationId')
  );
  strictAssert(
    conversation,
    'enqueuePollVoteForSend: No conversation extracted from target message'
  );
  strictAssert(
    isGroup(conversation.attributes),
    'enqueuePollVoteForSend: conversation must be a group'
  );

  const timestamp = Date.now();
  const targetAuthorAci = getSourceServiceId(message.attributes);
  strictAssert(targetAuthorAci, 'no author service ID');
  strictAssert(isAciString(targetAuthorAci), 'author must be ACI');
  const targetTimestamp = getMessageSentTimestamp(message.attributes, { log });
  strictAssert(targetTimestamp, 'no target timestamp');

  // Compute next voteCount for our ACI
  const ourId = window.ConversationController.getOurConversationIdOrThrow();
  const poll = message.get('poll');
  let nextVoteCount = 1;
  if (poll?.votes && poll.votes.length > 0) {
    const mine = poll.votes.filter(v => v.fromConversationId === ourId);
    if (mine.length > 0) {
      const maxCount = Math.max(...mine.map(v => v.voteCount || 0));
      nextVoteCount = maxCount + 1;
    }
  }

  // Update local state immediately
  const vote: PollVoteAttributesType = {
    envelopeId: generateUuid(),
    removeFromMessageReceiverCache: () => undefined,
    fromConversationId: ourId,
    source: PollSource.FromThisDevice,
    targetAuthorAci,
    targetTimestamp,
    optionIndexes: [...optionIndexes],
    voteCount: nextVoteCount,
    receivedAtDate: timestamp,
    timestamp,
  };

  await handlePollVote(message, vote, { shouldPersist: true });

  // Queue the send job
  await conversationJobQueue.add(
    {
      type: conversationQueueJobEnum.enum.PollVote,
      conversationId: conversation.id,
      pollMessageId: messageId,
      targetAuthorAci,
      targetTimestamp,
      revision: conversation.get('revision'),
    },
    async jobToInsert => {
      await window.MessageCache.saveMessage(message.attributes, {
        jobToInsert,
      });
    }
  );
}
