// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import { DataReader, DataWriter } from '../../sql/Client';
import { generateAci } from '../../types/ServiceId';

import type { ReactionType } from '../../types/Reactions';
import { ReactionReadStatus } from '../../types/Reactions';
import { DurationInSeconds } from '../../util/durations';
import type { MessageAttributesType } from '../../model-types.d';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { postSaveUpdates } from '../../util/cleanup';

const { _getAllReactions, _getAllMessages, getTotalUnreadForConversation } =
  DataReader;
const {
  _removeAllMessages,
  _removeAllReactions,
  addReaction,
  saveMessages,
  getUnreadByConversationAndMarkRead,
  getUnreadReactionsAndMarkRead,
} = DataWriter;

const UNREAD_REACTION = { readStatus: ReactionReadStatus.Unread };

describe('sql/markRead', () => {
  beforeEach(async () => {
    await _removeAllMessages();
    await _removeAllReactions();
  });

  it('properly finds and reads unread messages in current conversation', async () => {
    assert.lengthOf(await _getAllMessages(), 0);

    const start = Date.now();
    const readAt = start + 20;
    const conversationId = generateUuid();
    const ourAci = generateAci();

    const oldest: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 1',
      type: 'incoming',
      conversationId,
      sent_at: start + 1,
      received_at: start + 1,
      timestamp: start + 1,
      readStatus: ReadStatus.Read,
    };
    const oldestUnread: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 2',
      type: 'incoming',
      conversationId,
      sent_at: start + 2,
      received_at: start + 2,
      timestamp: start + 2,
      readStatus: ReadStatus.Unread,
    };
    const unreadInAnotherConvo: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 3',
      type: 'incoming',
      conversationId: generateUuid(),
      sent_at: start + 3,
      received_at: start + 3,
      timestamp: start + 3,
      readStatus: ReadStatus.Unread,
    };
    const unread: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 4',
      type: 'incoming',
      conversationId,
      sent_at: start + 4,
      received_at: start + 4,
      timestamp: start + 4,
      readStatus: ReadStatus.Unread,
    };
    const unreadStory: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 5',
      type: 'story',
      conversationId,
      sent_at: start + 5,
      received_at: start + 5,
      timestamp: start + 5,
      readStatus: ReadStatus.Unread,
      storyId: generateUuid(),
    };
    const unreadStoryReply: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 6',
      type: 'incoming',
      conversationId,
      sent_at: start + 6,
      received_at: start + 6,
      timestamp: start + 6,
      readStatus: ReadStatus.Unread,
      storyId: generateUuid(),
    };
    const newestUnread: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 7',
      type: 'incoming',
      conversationId,
      sent_at: start + 7,
      received_at: start + 7,
      timestamp: start + 7,
      readStatus: ReadStatus.Unread,
    };

    await saveMessages(
      [
        oldest,
        oldestUnread,
        unreadInAnotherConvo,
        unread,
        unreadStory,
        unreadStoryReply,
        newestUnread,
      ],
      {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      }
    );

    assert.lengthOf(await _getAllMessages(), 7);
    assert.strictEqual(
      await getTotalUnreadForConversation(conversationId, {
        storyId: undefined,
        includeStoryReplies: false,
      }),
      3,
      'no stories/unread count - before'
    );

    const markedRead = await getUnreadByConversationAndMarkRead({
      conversationId,
      newestUnreadAt: unreadStoryReply.received_at,
      readAt,
      includeStoryReplies: false,
    });

    assert.lengthOf(markedRead, 2, 'no stories/two messages marked read');
    assert.strictEqual(
      await getTotalUnreadForConversation(conversationId, {
        storyId: undefined,
        includeStoryReplies: false,
      }),
      1,
      'no stories/unread count - after'
    );

    // Sorted in descending order
    assert.strictEqual(
      markedRead[0].id,
      unread.id,
      'no stories/first should be "unread" message'
    );
    assert.strictEqual(
      markedRead[1].id,
      oldestUnread.id,
      'no stories/second should be oldestUnread'
    );

    const markedRead2 = await getUnreadByConversationAndMarkRead({
      conversationId,
      newestUnreadAt: newestUnread.received_at,
      readAt,
      includeStoryReplies: true,
    });

    assert.lengthOf(markedRead2, 2, 'with stories/two messages marked read');

    assert.strictEqual(
      markedRead2[0].id,
      newestUnread.id,
      'with stories/should be newestUnread'
    );
    assert.strictEqual(
      markedRead2[1].id,
      unreadStoryReply.id,
      'with stories/should be unreadStoryReply'
    );

    assert.strictEqual(
      await getTotalUnreadForConversation(conversationId, {
        storyId: undefined,
        includeStoryReplies: true,
      }),
      0,
      'with stories/unread count'
    );
  });

  it('properly finds and reads unread messages in story', async () => {
    assert.lengthOf(await _getAllMessages(), 0);

    const start = Date.now();
    const readAt = start + 20;
    const conversationId = generateUuid();
    const storyId = generateUuid();
    const ourAci = generateAci();

    const message1: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 1',
      type: 'story',
      conversationId,
      sent_at: start + 1,
      received_at: start + 1,
      timestamp: start + 1,
      readStatus: ReadStatus.Read,
      storyId,
    };
    const message2: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 2',
      type: 'incoming',
      conversationId,
      sent_at: start + 2,
      received_at: start + 2,
      timestamp: start + 2,
      readStatus: ReadStatus.Unread,
      storyId,
    };
    const message3: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 3',
      type: 'incoming',
      conversationId,
      sent_at: start + 3,
      received_at: start + 3,
      timestamp: start + 3,
      readStatus: ReadStatus.Unread,
      storyId: generateUuid(),
    };
    const message4: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 4',
      type: 'incoming',
      conversationId,
      sent_at: start + 4,
      received_at: start + 4,
      timestamp: start + 4,
      readStatus: ReadStatus.Unread,
      storyId,
    };
    const message5: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 5',
      type: 'incoming',
      conversationId,
      sent_at: start + 5,
      received_at: start + 5,
      timestamp: start + 5,
      readStatus: ReadStatus.Unread,
      storyId: generateUuid(),
    };
    const message6: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 6',
      type: 'incoming',
      conversationId,
      sent_at: start + 6,
      received_at: start + 6,
      timestamp: start + 6,
      readStatus: ReadStatus.Unread,
      storyId: generateUuid(),
    };
    const message7: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 7',
      type: 'incoming',
      conversationId,
      sent_at: start + 7,
      received_at: start + 7,
      timestamp: start + 7,
      readStatus: ReadStatus.Unread,
      storyId,
    };

    await saveMessages(
      [message1, message2, message3, message4, message5, message6, message7],
      {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      }
    );

    assert.lengthOf(await _getAllMessages(), 7);

    const markedRead = await getUnreadByConversationAndMarkRead({
      conversationId,
      newestUnreadAt: message7.received_at,
      readAt,
      storyId,
      includeStoryReplies: false,
    });

    assert.lengthOf(markedRead, 3, 'three messages marked read');

    // Sorted in descending order
    assert.strictEqual(
      markedRead[0].id,
      message7.id,
      'first should be message7'
    );
    assert.strictEqual(
      markedRead[1].id,
      message4.id,
      'first should be message4'
    );
    assert.strictEqual(
      markedRead[2].id,
      message2.id,
      'second should be message2'
    );
  });

  it('properly starts disappearing message timer, even if message is already read', async () => {
    const now = Date.now();
    assert.lengthOf(await _getAllMessages(), 0);

    const start = Date.now();
    const readAt = start + 20;
    const conversationId = generateUuid();
    const expireTimer = DurationInSeconds.fromSeconds(15);
    const ourAci = generateAci();

    const message1: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 1',
      type: 'incoming',
      conversationId,
      sent_at: start + 1,
      received_at: start + 1,
      timestamp: start + 1,
      expireTimer,
      expirationStartTimestamp: start + 1,
      readStatus: ReadStatus.Read,
    };
    const message2: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 2',
      type: 'incoming',
      conversationId,
      sent_at: start + 2,
      received_at: start + 2,
      timestamp: start + 2,
      expireTimer,
      readStatus: ReadStatus.Read,
    };
    const message3: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 3',
      type: 'incoming',
      conversationId: generateUuid(),
      sent_at: start + 3,
      received_at: start + 3,
      timestamp: start + 3,
      expireTimer,
      readStatus: ReadStatus.Unread,
    };
    const message4: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 4',
      type: 'incoming',
      conversationId,
      sent_at: start + 4,
      received_at: start + 4,
      timestamp: start + 4,
      expireTimer,
      readStatus: ReadStatus.Unread,
    };
    const message5: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 5',
      type: 'incoming',
      conversationId,
      sent_at: start + 5,
      received_at: start + 5,
      timestamp: start + 5,
      readStatus: ReadStatus.Unread,
    };

    await saveMessages([message1, message2, message3, message4, message5], {
      forceSave: true,
      ourAci,
      postSaveUpdates,
    });

    assert.strictEqual(
      await getTotalUnreadForConversation(conversationId, {
        storyId: undefined,
        includeStoryReplies: true,
      }),
      2,
      'unread count'
    );
    assert.lengthOf(await _getAllMessages(), 5);

    const markedRead = await getUnreadByConversationAndMarkRead({
      conversationId,
      newestUnreadAt: message4.received_at,
      readAt,
      includeStoryReplies: false,
      now,
    });

    assert.lengthOf(markedRead, 1, 'one message marked read');
    assert.strictEqual(
      markedRead[0].id,
      message4.id,
      'first should be message4'
    );
    assert.strictEqual(
      await getTotalUnreadForConversation(conversationId, {
        storyId: undefined,
        includeStoryReplies: true,
      }),
      1,
      'unread count'
    );

    const allMessages = await _getAllMessages();
    const sorted = allMessages.sort(
      (left, right) => left.timestamp - right.timestamp
    );

    assert.strictEqual(sorted[1].id, message2.id, 'checking message 2');
    assert.isAtMost(
      sorted[1].expirationStartTimestamp ?? Infinity,
      now,
      'checking message 2 expirationStartTimestamp'
    );

    assert.strictEqual(sorted[3].id, message4.id, 'checking message 4');
    assert.isAtMost(
      sorted[3].expirationStartTimestamp ?? Infinity,
      now,
      'checking message 4 expirationStartTimestamp'
    );
  });

  it('properly finds and reads unread reactions in current conversation', async () => {
    assert.lengthOf(await _getAllReactions(), 0);

    const start = Date.now();
    const conversationId = generateUuid();
    const storyId = generateUuid();
    const ourAci = generateAci();

    const pad: Array<MessageAttributesType> = Array.from({ length: 4 }, _ => {
      return {
        id: generateUuid(),
        body: 'pad message',
        type: 'incoming',
        conversationId,
        sent_at: start - 1,
        received_at: start - 1,
        timestamp: start - 1,
      };
    });
    const message1: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 1',
      type: 'incoming',
      conversationId,
      sent_at: start + 1,
      received_at: start + 1,
      timestamp: start + 1,
    };
    const message2: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 2',
      type: 'incoming',
      conversationId,
      sent_at: start + 2,
      received_at: start + 2,
      timestamp: start + 2,
      storyId,
    };
    const message3: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 3',
      type: 'incoming',
      conversationId: generateUuid(),
      sent_at: start + 3,
      received_at: start + 3,
      timestamp: start + 3,
    };
    const message4: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 4',
      type: 'incoming',
      conversationId,
      sent_at: start + 4,
      received_at: start + 4,
      timestamp: start + 4,
    };
    const message5: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 5',
      type: 'incoming',
      conversationId,
      sent_at: start + 5,
      received_at: start + 5,
      timestamp: start + 5,
    };

    await saveMessages(
      [...pad, message1, message2, message3, message4, message5],
      {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      }
    );
    assert.lengthOf(await _getAllMessages(), pad.length + 5);

    const reaction1: ReactionType = {
      conversationId,
      emoji: '🎉',
      fromId: generateUuid(),
      messageId: message1.id,
      messageReceivedAt: message1.received_at,
      targetAuthorAci: generateAci(),
      targetTimestamp: start,
      timestamp: start,
    };
    const reaction2: ReactionType = {
      conversationId,
      emoji: '🚀',
      fromId: generateUuid(),
      messageId: message2.id,
      messageReceivedAt: message2.received_at,
      targetAuthorAci: generateAci(),
      targetTimestamp: start,
      timestamp: start,
    };
    const reaction3: ReactionType = {
      conversationId: generateUuid(),
      emoji: '☀️',
      fromId: generateUuid(),
      messageId: message3.id,
      messageReceivedAt: message3.received_at,
      targetAuthorAci: generateAci(),
      targetTimestamp: start,
      timestamp: start,
    };
    const reaction4: ReactionType = {
      conversationId,
      emoji: '❤️‍🔥',
      fromId: generateUuid(),
      messageId: message4.id,
      messageReceivedAt: message4.received_at,
      targetAuthorAci: generateAci(),
      targetTimestamp: start,
      timestamp: start,
    };
    const reaction5: ReactionType = {
      conversationId,
      emoji: '🆒',
      fromId: generateUuid(),
      messageId: message5.id,
      messageReceivedAt: message5.received_at,
      targetAuthorAci: generateAci(),
      targetTimestamp: start,
      timestamp: start,
    };

    await addReaction(reaction1, UNREAD_REACTION);
    await addReaction(reaction2, UNREAD_REACTION);
    await addReaction(reaction3, UNREAD_REACTION);
    await addReaction(reaction4, UNREAD_REACTION);
    await addReaction(reaction5, UNREAD_REACTION);

    assert.lengthOf(await _getAllReactions(), 5);
    const markedRead = await getUnreadReactionsAndMarkRead({
      conversationId,
      newestUnreadAt: reaction4.messageReceivedAt,
    });

    assert.lengthOf(markedRead, 2, 'two reactions marked read');

    // Sorted in descending order
    assert.strictEqual(
      markedRead[0].messageId,
      reaction4.messageId,
      'first should be reaction4'
    );
    assert.strictEqual(
      markedRead[1].messageId,
      reaction1.messageId,
      'second should be reaction1'
    );

    const markedRead2 = await getUnreadReactionsAndMarkRead({
      conversationId,
      newestUnreadAt: reaction5.messageReceivedAt,
    });

    assert.lengthOf(markedRead2, 1);
    assert.strictEqual(
      markedRead2[0].messageId,
      reaction5.messageId,
      'should be reaction5'
    );
  });

  it('properly finds and reads unread reactions in story', async () => {
    assert.lengthOf(await _getAllReactions(), 0);

    const start = Date.now();
    const conversationId = generateUuid();
    const storyId = generateUuid();
    const ourAci = generateAci();

    const message1: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 1',
      type: 'incoming',
      conversationId,
      sent_at: start + 1,
      received_at: start + 1,
      timestamp: start + 1,
      storyId,
    };
    const message2: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 2',
      type: 'incoming',
      conversationId,
      sent_at: start + 2,
      received_at: start + 2,
      timestamp: start + 2,
      storyId: generateUuid(),
    };
    const message3: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 3',
      type: 'incoming',
      conversationId: generateUuid(),
      sent_at: start + 3,
      received_at: start + 3,
      timestamp: start + 3,
    };
    const message4: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 4',
      type: 'incoming',
      conversationId,
      sent_at: start + 4,
      received_at: start + 4,
      timestamp: start + 4,
      storyId,
    };
    const message5: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 5',
      type: 'incoming',
      conversationId,
      sent_at: start + 5,
      received_at: start + 5,
      timestamp: start + 5,
      storyId,
    };

    await saveMessages([message1, message2, message3, message4, message5], {
      forceSave: true,
      ourAci,
      postSaveUpdates,
    });
    assert.lengthOf(await _getAllMessages(), 5);

    const reaction1: ReactionType = {
      conversationId,
      emoji: '🎉',
      fromId: generateUuid(),
      messageId: message1.id,
      messageReceivedAt: message1.received_at,
      targetAuthorAci: generateAci(),
      targetTimestamp: start,
      timestamp: start,
    };
    const reaction2: ReactionType = {
      conversationId,
      emoji: '🚀',
      fromId: generateUuid(),
      messageId: message2.id,
      messageReceivedAt: message2.received_at,
      targetAuthorAci: generateAci(),
      targetTimestamp: start,
      timestamp: start,
    };
    const reaction3: ReactionType = {
      conversationId: generateUuid(),
      emoji: '☀️',
      fromId: generateUuid(),
      messageId: message3.id,
      messageReceivedAt: message3.received_at,
      targetAuthorAci: generateAci(),
      targetTimestamp: start,
      timestamp: start,
    };
    const reaction4: ReactionType = {
      conversationId,
      emoji: '❤️‍🔥',
      fromId: generateUuid(),
      messageId: message4.id,
      messageReceivedAt: message4.received_at,
      targetAuthorAci: generateAci(),
      targetTimestamp: start,
      timestamp: start,
    };
    const reaction5: ReactionType = {
      conversationId,
      emoji: '🆒',
      fromId: generateUuid(),
      messageId: message5.id,
      messageReceivedAt: message5.received_at,
      targetAuthorAci: generateAci(),
      targetTimestamp: start,
      timestamp: start,
    };

    await addReaction(reaction1, UNREAD_REACTION);
    await addReaction(reaction2, UNREAD_REACTION);
    await addReaction(reaction3, UNREAD_REACTION);
    await addReaction(reaction4, UNREAD_REACTION);
    await addReaction(reaction5, UNREAD_REACTION);

    assert.lengthOf(await _getAllReactions(), 5);
    const markedRead = await getUnreadReactionsAndMarkRead({
      conversationId,
      newestUnreadAt: reaction4.messageReceivedAt,
      storyId,
    });

    assert.lengthOf(markedRead, 2, 'two reactions marked read');

    // Sorted in descending order
    assert.strictEqual(
      markedRead[0].messageId,
      reaction4.messageId,
      'first should be reaction4'
    );
    assert.strictEqual(
      markedRead[1].messageId,
      reaction1.messageId,
      'second should be reaction1'
    );

    const markedRead2 = await getUnreadReactionsAndMarkRead({
      conversationId,
      newestUnreadAt: reaction5.messageReceivedAt,
      storyId,
    });

    assert.lengthOf(markedRead2, 1);
    assert.strictEqual(
      markedRead2[0].messageId,
      reaction5.messageId,
      'should be reaction5'
    );
  });

  it('does not include group story replies', async () => {
    assert.lengthOf(await _getAllMessages(), 0);

    const start = Date.now();
    const readAt = start + 20;
    const conversationId = generateUuid();
    const storyId = generateUuid();
    const ourAci = generateAci();

    const message1: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 1',
      type: 'story',
      conversationId,
      sent_at: start + 1,
      received_at: start + 1,
      timestamp: start + 1,
      readStatus: ReadStatus.Read,
    };
    const message2: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 2',
      type: 'incoming',
      conversationId,
      sent_at: start + 2,
      received_at: start + 2,
      timestamp: start + 2,
      readStatus: ReadStatus.Unread,
      storyId,
    };
    const message3: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 3',
      type: 'incoming',
      conversationId,
      sent_at: start + 3,
      received_at: start + 3,
      timestamp: start + 3,
      readStatus: ReadStatus.Unread,
    };
    const message4: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 4',
      type: 'incoming',
      conversationId,
      sent_at: start + 4,
      received_at: start + 4,
      timestamp: start + 4,
      readStatus: ReadStatus.Unread,
      storyId,
    };

    await saveMessages([message1, message2, message3, message4], {
      forceSave: true,
      ourAci,
      postSaveUpdates,
    });

    assert.lengthOf(await _getAllMessages(), 4);

    const markedRead = await getUnreadByConversationAndMarkRead({
      conversationId,
      includeStoryReplies: false,
      newestUnreadAt: message4.received_at,
      readAt,
    });

    assert.lengthOf(markedRead, 1, '1 message marked read');

    // Sorted in descending order
    assert.strictEqual(
      markedRead[0].id,
      message3.id,
      'first should be message3'
    );
  });
});
