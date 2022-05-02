// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import dataInterface from '../../sql/Client';
import { UUID } from '../../types/UUID';
import type { UUIDStringType } from '../../types/UUID';

import type { ReactionType } from '../../types/Reactions';
import type { MessageAttributesType } from '../../model-types.d';
import { ReadStatus } from '../../messages/MessageReadStatus';

const {
  _removeAllMessages,
  _removeAllReactions,
  _getAllReactions,
  _getAllMessages,
  addReaction,
  saveMessages,
  getTotalUnreadForConversation,
  getUnreadByConversationAndMarkRead,
  getUnreadReactionsAndMarkRead,
} = dataInterface;

function getUuid(): UUIDStringType {
  return UUID.generate().toString();
}

describe('sql/markRead', () => {
  beforeEach(async () => {
    await _removeAllMessages();
    await _removeAllReactions();
  });

  it('properly finds and reads unread messages in current conversation', async () => {
    assert.lengthOf(await _getAllMessages(), 0);

    const start = Date.now();
    const readAt = start + 20;
    const conversationId = getUuid();
    const ourUuid = getUuid();

    const message1: MessageAttributesType = {
      id: getUuid(),
      body: 'message 1',
      type: 'incoming',
      conversationId,
      sent_at: start + 1,
      received_at: start + 1,
      timestamp: start + 1,
      readStatus: ReadStatus.Read,
    };
    const message2: MessageAttributesType = {
      id: getUuid(),
      body: 'message 2',
      type: 'incoming',
      conversationId,
      sent_at: start + 2,
      received_at: start + 2,
      timestamp: start + 2,
      readStatus: ReadStatus.Unread,
    };
    const message3: MessageAttributesType = {
      id: getUuid(),
      body: 'message 3',
      type: 'incoming',
      conversationId: getUuid(),
      sent_at: start + 3,
      received_at: start + 3,
      timestamp: start + 3,
      readStatus: ReadStatus.Unread,
    };
    const message4: MessageAttributesType = {
      id: getUuid(),
      body: 'message 4',
      type: 'incoming',
      conversationId,
      sent_at: start + 4,
      received_at: start + 4,
      timestamp: start + 4,
      readStatus: ReadStatus.Unread,
    };
    const message5: MessageAttributesType = {
      id: getUuid(),
      body: 'message 5',
      type: 'story',
      conversationId,
      sent_at: start + 5,
      received_at: start + 5,
      timestamp: start + 5,
      readStatus: ReadStatus.Unread,
      storyId: getUuid(),
    };
    const message6: MessageAttributesType = {
      id: getUuid(),
      body: 'message 6',
      type: 'incoming',
      conversationId,
      sent_at: start + 6,
      received_at: start + 6,
      timestamp: start + 6,
      readStatus: ReadStatus.Unread,
      storyId: getUuid(),
    };
    const message7: MessageAttributesType = {
      id: getUuid(),
      body: 'message 7',
      type: 'incoming',
      conversationId,
      sent_at: start + 7,
      received_at: start + 7,
      timestamp: start + 7,
      readStatus: ReadStatus.Unread,
    };

    await saveMessages(
      [message1, message2, message3, message4, message5, message6, message7],
      {
        forceSave: true,
        ourUuid,
      }
    );

    assert.lengthOf(await _getAllMessages(), 7);
    assert.strictEqual(
      await getTotalUnreadForConversation(conversationId, {
        storyId: undefined,
        isGroup: false,
      }),
      4,
      'unread count'
    );

    const markedRead = await getUnreadByConversationAndMarkRead({
      conversationId,
      newestUnreadAt: message4.received_at,
      readAt,
    });

    assert.lengthOf(markedRead, 2, 'two messages marked read');
    assert.strictEqual(
      await getTotalUnreadForConversation(conversationId, {
        storyId: undefined,
        isGroup: false,
      }),
      2,
      'unread count'
    );

    // Sorted in descending order
    assert.strictEqual(
      markedRead[0].id,
      message4.id,
      'first should be message4'
    );
    assert.strictEqual(
      markedRead[1].id,
      message2.id,
      'second should be message2'
    );

    const markedRead2 = await getUnreadByConversationAndMarkRead({
      conversationId,
      newestUnreadAt: message7.received_at,
      readAt,
    });

    assert.lengthOf(markedRead2, 2, 'two messages marked read');
    assert.strictEqual(markedRead2[0].id, message7.id, 'should be message7');

    assert.strictEqual(
      await getTotalUnreadForConversation(conversationId, {
        storyId: undefined,
        isGroup: false,
      }),
      0,
      'unread count'
    );
  });

  it('properly finds and reads unread messages in story', async () => {
    assert.lengthOf(await _getAllMessages(), 0);

    const start = Date.now();
    const readAt = start + 20;
    const conversationId = getUuid();
    const storyId = getUuid();
    const ourUuid = getUuid();

    const message1: MessageAttributesType = {
      id: getUuid(),
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
      id: getUuid(),
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
      id: getUuid(),
      body: 'message 3',
      type: 'incoming',
      conversationId,
      sent_at: start + 3,
      received_at: start + 3,
      timestamp: start + 3,
      readStatus: ReadStatus.Unread,
      storyId: getUuid(),
    };
    const message4: MessageAttributesType = {
      id: getUuid(),
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
      id: getUuid(),
      body: 'message 5',
      type: 'incoming',
      conversationId,
      sent_at: start + 5,
      received_at: start + 5,
      timestamp: start + 5,
      readStatus: ReadStatus.Unread,
      storyId: getUuid(),
    };
    const message6: MessageAttributesType = {
      id: getUuid(),
      body: 'message 6',
      type: 'incoming',
      conversationId,
      sent_at: start + 6,
      received_at: start + 6,
      timestamp: start + 6,
      readStatus: ReadStatus.Unread,
      storyId: getUuid(),
    };
    const message7: MessageAttributesType = {
      id: getUuid(),
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
        ourUuid,
      }
    );

    assert.lengthOf(await _getAllMessages(), 7);

    const markedRead = await getUnreadByConversationAndMarkRead({
      conversationId,
      newestUnreadAt: message7.received_at,
      readAt,
      storyId,
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
    assert.lengthOf(await _getAllMessages(), 0);

    const start = Date.now();
    const readAt = start + 20;
    const conversationId = getUuid();
    const expireTimer = 15;
    const ourUuid = getUuid();

    const message1: MessageAttributesType = {
      id: getUuid(),
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
      id: getUuid(),
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
      id: getUuid(),
      body: 'message 3',
      type: 'incoming',
      conversationId: getUuid(),
      sent_at: start + 3,
      received_at: start + 3,
      timestamp: start + 3,
      expireTimer,
      readStatus: ReadStatus.Unread,
    };
    const message4: MessageAttributesType = {
      id: getUuid(),
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
      id: getUuid(),
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
      ourUuid,
    });

    assert.strictEqual(
      await getTotalUnreadForConversation(conversationId, {
        storyId: undefined,
        isGroup: false,
      }),
      2,
      'unread count'
    );
    assert.lengthOf(await _getAllMessages(), 5);

    const markedRead = await getUnreadByConversationAndMarkRead({
      conversationId,
      newestUnreadAt: message4.received_at,
      readAt,
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
        isGroup: false,
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
      Date.now(),
      'checking message 2 expirationStartTimestamp'
    );

    assert.strictEqual(sorted[3].id, message4.id, 'checking message 4');
    assert.isAtMost(
      sorted[3].expirationStartTimestamp ?? Infinity,
      Date.now(),
      'checking message 4 expirationStartTimestamp'
    );
  });

  it('properly finds and reads unread reactions in current conversation', async () => {
    assert.lengthOf(await _getAllReactions(), 0);

    const start = Date.now();
    const conversationId = getUuid();
    const storyId = getUuid();
    const ourUuid = getUuid();

    const pad: Array<MessageAttributesType> = Array.from({ length: 4 }, _ => {
      return {
        id: getUuid(),
        body: 'pad message',
        type: 'incoming',
        conversationId,
        sent_at: start - 1,
        received_at: start - 1,
        timestamp: start - 1,
      };
    });
    const message1: MessageAttributesType = {
      id: getUuid(),
      body: 'message 1',
      type: 'incoming',
      conversationId,
      sent_at: start + 1,
      received_at: start + 1,
      timestamp: start + 1,
    };
    const message2: MessageAttributesType = {
      id: getUuid(),
      body: 'message 2',
      type: 'incoming',
      conversationId,
      sent_at: start + 2,
      received_at: start + 2,
      timestamp: start + 2,
      storyId,
    };
    const message3: MessageAttributesType = {
      id: getUuid(),
      body: 'message 3',
      type: 'incoming',
      conversationId: getUuid(),
      sent_at: start + 3,
      received_at: start + 3,
      timestamp: start + 3,
    };
    const message4: MessageAttributesType = {
      id: getUuid(),
      body: 'message 4',
      type: 'incoming',
      conversationId,
      sent_at: start + 4,
      received_at: start + 4,
      timestamp: start + 4,
    };
    const message5: MessageAttributesType = {
      id: getUuid(),
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
        ourUuid,
      }
    );
    assert.lengthOf(await _getAllMessages(), pad.length + 5);

    const reaction1: ReactionType = {
      conversationId,
      emoji: '🎉',
      fromId: getUuid(),
      messageId: message1.id,
      messageReceivedAt: message1.received_at,
      targetAuthorUuid: getUuid(),
      targetTimestamp: start,
    };
    const reaction2: ReactionType = {
      conversationId,
      emoji: '🚀',
      fromId: getUuid(),
      messageId: message2.id,
      messageReceivedAt: message2.received_at,
      targetAuthorUuid: getUuid(),
      targetTimestamp: start,
    };
    const reaction3: ReactionType = {
      conversationId: getUuid(),
      emoji: '☀️',
      fromId: getUuid(),
      messageId: message3.id,
      messageReceivedAt: message3.received_at,
      targetAuthorUuid: getUuid(),
      targetTimestamp: start,
    };
    const reaction4: ReactionType = {
      conversationId,
      emoji: '❤️‍🔥',
      fromId: getUuid(),
      messageId: message4.id,
      messageReceivedAt: message4.received_at,
      targetAuthorUuid: getUuid(),
      targetTimestamp: start,
    };
    const reaction5: ReactionType = {
      conversationId,
      emoji: '🆒',
      fromId: getUuid(),
      messageId: message5.id,
      messageReceivedAt: message5.received_at,
      targetAuthorUuid: getUuid(),
      targetTimestamp: start,
    };

    await addReaction(reaction1);
    await addReaction(reaction2);
    await addReaction(reaction3);
    await addReaction(reaction4);
    await addReaction(reaction5);

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
    const conversationId = getUuid();
    const storyId = getUuid();
    const ourUuid = getUuid();

    const message1: MessageAttributesType = {
      id: getUuid(),
      body: 'message 1',
      type: 'incoming',
      conversationId,
      sent_at: start + 1,
      received_at: start + 1,
      timestamp: start + 1,
      storyId,
    };
    const message2: MessageAttributesType = {
      id: getUuid(),
      body: 'message 2',
      type: 'incoming',
      conversationId,
      sent_at: start + 2,
      received_at: start + 2,
      timestamp: start + 2,
      storyId: getUuid(),
    };
    const message3: MessageAttributesType = {
      id: getUuid(),
      body: 'message 3',
      type: 'incoming',
      conversationId: getUuid(),
      sent_at: start + 3,
      received_at: start + 3,
      timestamp: start + 3,
    };
    const message4: MessageAttributesType = {
      id: getUuid(),
      body: 'message 4',
      type: 'incoming',
      conversationId,
      sent_at: start + 4,
      received_at: start + 4,
      timestamp: start + 4,
      storyId,
    };
    const message5: MessageAttributesType = {
      id: getUuid(),
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
      ourUuid,
    });
    assert.lengthOf(await _getAllMessages(), 5);

    const reaction1: ReactionType = {
      conversationId,
      emoji: '🎉',
      fromId: getUuid(),
      messageId: message1.id,
      messageReceivedAt: message1.received_at,
      targetAuthorUuid: getUuid(),
      targetTimestamp: start,
    };
    const reaction2: ReactionType = {
      conversationId,
      emoji: '🚀',
      fromId: getUuid(),
      messageId: message2.id,
      messageReceivedAt: message2.received_at,
      targetAuthorUuid: getUuid(),
      targetTimestamp: start,
    };
    const reaction3: ReactionType = {
      conversationId: getUuid(),
      emoji: '☀️',
      fromId: getUuid(),
      messageId: message3.id,
      messageReceivedAt: message3.received_at,
      targetAuthorUuid: getUuid(),
      targetTimestamp: start,
    };
    const reaction4: ReactionType = {
      conversationId,
      emoji: '❤️‍🔥',
      fromId: getUuid(),
      messageId: message4.id,
      messageReceivedAt: message4.received_at,
      targetAuthorUuid: getUuid(),
      targetTimestamp: start,
    };
    const reaction5: ReactionType = {
      conversationId,
      emoji: '🆒',
      fromId: getUuid(),
      messageId: message5.id,
      messageReceivedAt: message5.received_at,
      targetAuthorUuid: getUuid(),
      targetTimestamp: start,
    };

    await addReaction(reaction1);
    await addReaction(reaction2);
    await addReaction(reaction3);
    await addReaction(reaction4);
    await addReaction(reaction5);

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
    const conversationId = getUuid();
    const storyId = getUuid();
    const ourUuid = getUuid();

    const message1: MessageAttributesType = {
      id: getUuid(),
      body: 'message 1',
      type: 'story',
      conversationId,
      sent_at: start + 1,
      received_at: start + 1,
      timestamp: start + 1,
      readStatus: ReadStatus.Read,
    };
    const message2: MessageAttributesType = {
      id: getUuid(),
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
      id: getUuid(),
      body: 'message 3',
      type: 'incoming',
      conversationId,
      sent_at: start + 3,
      received_at: start + 3,
      timestamp: start + 3,
      readStatus: ReadStatus.Unread,
    };
    const message4: MessageAttributesType = {
      id: getUuid(),
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
      ourUuid,
    });

    assert.lengthOf(await _getAllMessages(), 4);

    const markedRead = await getUnreadByConversationAndMarkRead({
      conversationId,
      isGroup: true,
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
