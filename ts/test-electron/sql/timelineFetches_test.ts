// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import { DataReader, DataWriter } from '../../sql/Client';
import { generateAci } from '../../types/ServiceId';

import type { MessageAttributesType } from '../../model-types.d';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { postSaveUpdates } from '../../util/cleanup';

const {
  _getAllMessages,
  getMessageMetricsForConversation,
  getNewerMessagesByConversation,
  getOlderMessagesByConversation,
  getTotalUnreadMentionsOfMeForConversation,
  getOldestUnreadMentionOfMeForConversation,
} = DataReader;

const { removeAll, saveMessages } = DataWriter;

describe('sql/timelineFetches', () => {
  beforeEach(async () => {
    await removeAll();
  });

  describe('getOlderMessagesByConversation', () => {
    it('returns N most recent messages', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = generateUuid();
      const storyId = generateUuid();
      const ourAci = generateAci();

      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: now - 20,
        received_at: now - 20,
        timestamp: now - 20,
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: now - 10,
        received_at: now - 10,
        timestamp: now - 10,
      };
      const message3: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 3',
        type: 'outgoing',
        conversationId: generateUuid(),
        sent_at: now,
        received_at: now,
        timestamp: now,
      };
      const message4: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 4',
        type: 'story',
        conversationId,
        sent_at: now,
        received_at: now,
        timestamp: now,
        storyId,
      };
      const message5: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 5',
        type: 'outgoing',
        conversationId,
        sent_at: now,
        received_at: now,
        timestamp: now,
        storyId,
      };

      await saveMessages([message1, message2, message3, message4, message5], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      assert.lengthOf(await _getAllMessages(), 5);

      const messages = await getOlderMessagesByConversation({
        conversationId,
        includeStoryReplies: true,
        limit: 5,
        storyId: undefined,
      });
      assert.lengthOf(messages, 3);

      // Fetched with DESC query, but with reverse() call afterwards
      assert.strictEqual(messages[0].id, message1.id);
      assert.strictEqual(messages[1].id, message2.id);
    });

    it('returns N most recent messages for a given story', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = generateUuid();
      const storyId = generateUuid();
      const ourAci = generateAci();

      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'story',
        type: 'story',
        conversationId,
        sent_at: now - 20,
        received_at: now - 20,
        timestamp: now - 20,
        storyId,
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'story reply 1',
        type: 'outgoing',
        conversationId,
        sent_at: now - 10,
        received_at: now - 10,
        timestamp: now - 10,
        storyId,
      };
      const message3: MessageAttributesType = {
        id: generateUuid(),
        body: 'normal message',
        type: 'outgoing',
        conversationId,
        sent_at: now,
        received_at: now,
        timestamp: now,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const messages = await getOlderMessagesByConversation({
        conversationId,
        includeStoryReplies: false,
        limit: 5,
        storyId,
      });
      assert.lengthOf(messages, 1);
      assert.strictEqual(messages[0].id, message2.id);
    });

    it('returns N most recent messages excluding group story replies', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = generateUuid();
      const storyId = generateUuid();
      const ourAci = generateAci();

      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'story',
        type: 'incoming',
        conversationId,
        sent_at: now - 20,
        received_at: now - 20,
        timestamp: now - 20,
        storyId,
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'story reply 1',
        type: 'outgoing',
        conversationId,
        sent_at: now - 10,
        received_at: now - 10,
        timestamp: now - 10,
        storyId,
      };
      const message3: MessageAttributesType = {
        id: generateUuid(),
        body: 'normal message',
        type: 'outgoing',
        conversationId,
        sent_at: now,
        received_at: now,
        timestamp: now,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const messages = await getOlderMessagesByConversation({
        conversationId,
        includeStoryReplies: false,
        limit: 5,
        storyId: undefined,
      });
      assert.lengthOf(messages, 1);
      assert.strictEqual(messages[0].id, message3.id);
    });

    it('returns N messages older than provided received_at', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const target = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();

      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: target - 10,
        received_at: target - 10,
        timestamp: target - 10,
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: target,
        received_at: target,
        timestamp: target,
      };
      const message3: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 3',
        type: 'outgoing',
        conversationId,
        sent_at: target + 10,
        received_at: target + 10,
        timestamp: target + 10,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const messages = await getOlderMessagesByConversation({
        conversationId,
        includeStoryReplies: false,
        limit: 5,
        receivedAt: target,
        sentAt: target,
        storyId: undefined,
      });
      assert.lengthOf(messages, 1);
      assert.strictEqual(messages[0].id, message1.id);
    });

    it('returns N older messages with received_at, lesser sent_at', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const target = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();

      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: target - 20,
        received_at: target,
        timestamp: target,
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: target - 10,
        received_at: target,
        timestamp: target,
      };
      const message3: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 3',
        type: 'outgoing',
        conversationId,
        sent_at: target,
        received_at: target,
        timestamp: target,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const messages = await getOlderMessagesByConversation({
        conversationId,
        includeStoryReplies: false,
        limit: 5,
        receivedAt: target,
        sentAt: target,
        storyId: undefined,
      });

      assert.lengthOf(messages, 2);

      // Fetched with DESC query, but with reverse() call afterwards
      assert.strictEqual(messages[0].id, message1.id, 'checking message 1');
      assert.strictEqual(messages[1].id, message2.id, 'checking message 2');
    });

    it('returns N older messages, same received_at/sent_at but excludes messageId', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const target = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();

      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: target - 10,
        received_at: target,
        timestamp: target,
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: target - 10,
        received_at: target,
        timestamp: target,
      };
      const message3: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 3',
        type: 'outgoing',
        conversationId,
        sent_at: target,
        received_at: target,
        timestamp: target,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const messages = await getOlderMessagesByConversation({
        conversationId,
        includeStoryReplies: false,
        limit: 5,
        messageId: message2.id,
        receivedAt: target,
        sentAt: target,
        storyId: undefined,
      });

      assert.lengthOf(messages, 1);
      assert.strictEqual(messages[0].id, message1.id);
    });
  });

  describe('getNewerMessagesByConversation', () => {
    it('returns N oldest messages with no parameters', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = generateUuid();
      const storyId = generateUuid();
      const ourAci = generateAci();

      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId: generateUuid(),
        sent_at: now,
        received_at: now,
        timestamp: now,
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 2',
        type: 'story',
        conversationId,
        sent_at: now,
        received_at: now,
        timestamp: now,
        storyId,
      };
      const message3: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 3',
        type: 'outgoing',
        conversationId,
        sent_at: now,
        received_at: now,
        timestamp: now,
        storyId,
      };
      const message4: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 4',
        type: 'outgoing',
        conversationId,
        sent_at: now + 10,
        received_at: now + 10,
        timestamp: now + 10,
      };
      const message5: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 5',
        type: 'outgoing',
        conversationId,
        sent_at: now + 20,
        received_at: now + 20,
        timestamp: now + 20,
      };

      await saveMessages([message1, message2, message3, message4, message5], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      assert.lengthOf(await _getAllMessages(), 5);

      const messages = await getNewerMessagesByConversation({
        conversationId,
        includeStoryReplies: true,
        limit: 5,
        storyId: undefined,
      });

      assert.lengthOf(messages, 3);
      assert.strictEqual(messages[0].id, message3.id, 'checking message 3');
      assert.strictEqual(messages[1].id, message4.id, 'checking message 4');
    });

    it('returns N oldest messages for a given story with no parameters', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = generateUuid();
      const storyId = generateUuid();
      const ourAci = generateAci();

      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1',
        type: 'story',
        conversationId,
        sent_at: now,
        received_at: now,
        timestamp: now,
        storyId,
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: now + 10,
        received_at: now + 10,
        timestamp: now + 10,
        storyId,
      };
      const message3: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 3',
        type: 'outgoing',
        conversationId,
        sent_at: now + 20,
        received_at: now + 20,
        timestamp: now + 20,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const messages = await getNewerMessagesByConversation({
        conversationId,
        includeStoryReplies: false,
        limit: 5,
        storyId,
      });

      assert.lengthOf(messages, 1);
      assert.strictEqual(messages[0].id, message2.id);
    });

    it('returns N messages newer than provided received_at', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const target = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();

      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: target - 10,
        received_at: target - 10,
        timestamp: target - 10,
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: target,
        received_at: target,
        timestamp: target,
      };
      const message3: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 3',
        type: 'outgoing',
        conversationId,
        sent_at: target + 10,
        received_at: target + 10,
        timestamp: target + 10,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const messages = await getNewerMessagesByConversation({
        conversationId,
        includeStoryReplies: false,
        limit: 5,
        receivedAt: target,
        sentAt: target,
        storyId: undefined,
      });
      assert.lengthOf(messages, 1);
      assert.strictEqual(messages[0].id, message3.id);
    });

    it('returns N messages excluding group story replies', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const target = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();

      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: target - 10,
        received_at: target - 10,
        timestamp: target - 10,
        storyId: generateUuid(),
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: target + 20,
        received_at: target + 20,
        timestamp: target + 20,
      };
      const message3: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 3',
        type: 'outgoing',
        conversationId,
        sent_at: target + 10,
        received_at: target + 10,
        timestamp: target + 10,
        storyId: generateUuid(),
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const messages = await getNewerMessagesByConversation({
        conversationId,
        includeStoryReplies: false,
        limit: 5,
        storyId: undefined,
        receivedAt: target,
        sentAt: target,
      });
      assert.lengthOf(messages, 1);
      assert.strictEqual(messages[0].id, message2.id);
    });

    it('returns N newer messages with same received_at, greater sent_at', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const target = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();

      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: target,
        received_at: target,
        timestamp: target,
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: target + 10,
        received_at: target,
        timestamp: target,
      };
      const message3: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 3',
        type: 'outgoing',
        conversationId,
        sent_at: target + 20,
        received_at: target,
        timestamp: target,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const messages = await getNewerMessagesByConversation({
        conversationId,
        includeStoryReplies: false,
        limit: 5,
        receivedAt: target,
        sentAt: target,
        storyId: undefined,
      });

      assert.lengthOf(messages, 2);
      // They are not in DESC order because MessageCollection is sorting them
      assert.strictEqual(messages[0].id, message2.id);
      assert.strictEqual(messages[1].id, message3.id);
    });
  });

  describe('getMessageMetricsForConversation', () => {
    it('returns metrics properly for story and non-story timelines', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const target = Date.now();
      const conversationId = generateUuid();
      const storyId = generateUuid();
      const ourAci = generateAci();

      const story: MessageAttributesType = {
        id: generateUuid(),
        body: 'story',
        type: 'story',
        conversationId,
        sent_at: target - 10,
        received_at: target - 10,
        timestamp: target - 10,
      };
      const oldestInStory: MessageAttributesType = {
        id: generateUuid(),
        body: 'oldestInStory',
        type: 'outgoing',
        conversationId,
        sent_at: target - 9,
        received_at: target - 9,
        timestamp: target - 9,
        storyId,
      };
      const oldest: MessageAttributesType = {
        id: generateUuid(),
        body: 'oldest',
        type: 'outgoing',
        conversationId,
        sent_at: target - 8,
        received_at: target - 8,
        timestamp: target - 8,
      };
      const oldestUnseen: MessageAttributesType = {
        id: generateUuid(),
        body: 'oldestUnseen',
        type: 'incoming',
        conversationId,
        sent_at: target - 7,
        received_at: target - 7,
        timestamp: target - 7,
        readStatus: ReadStatus.Unread,
      };
      const oldestStoryUnread: MessageAttributesType = {
        id: generateUuid(),
        body: 'oldestStoryUnread',
        type: 'incoming',
        conversationId,
        sent_at: target - 6,
        received_at: target - 6,
        timestamp: target - 6,
        readStatus: ReadStatus.Unread,
        storyId,
      };
      const anotherUnread: MessageAttributesType = {
        id: generateUuid(),
        body: 'anotherUnread',
        type: 'incoming',
        conversationId,
        sent_at: target - 5,
        received_at: target - 5,
        timestamp: target - 5,
        readStatus: ReadStatus.Unread,
      };
      const newestInStory: MessageAttributesType = {
        id: generateUuid(),
        body: 'newestStory',
        type: 'outgoing',
        conversationId,
        sent_at: target - 4,
        received_at: target - 4,
        timestamp: target - 4,
        storyId,
      };
      const newest: MessageAttributesType = {
        id: generateUuid(),
        body: 'newest',
        type: 'outgoing',
        conversationId,
        sent_at: target - 3,
        received_at: target - 3,
        timestamp: target - 3,
      };

      await saveMessages(
        [
          story,
          oldestInStory,
          oldest,
          oldestUnseen,
          oldestStoryUnread,
          anotherUnread,
          newestInStory,
          newest,
        ],
        { forceSave: true, ourAci, postSaveUpdates }
      );

      assert.lengthOf(await _getAllMessages(), 8);

      const metricsInTimeline = await getMessageMetricsForConversation({
        conversationId,
        includeStoryReplies: false,
      });
      assert.strictEqual(metricsInTimeline?.oldest?.id, oldest.id, 'oldest');
      assert.strictEqual(metricsInTimeline?.newest?.id, newest.id, 'newest');
      assert.strictEqual(
        metricsInTimeline?.oldestUnseen?.id,
        oldestUnseen.id,
        'oldestUnseen'
      );
      assert.strictEqual(metricsInTimeline?.totalUnseen, 2, 'totalUnseen');

      const metricsInStory = await getMessageMetricsForConversation({
        conversationId,
        storyId,
        includeStoryReplies: true,
      });
      assert.strictEqual(
        metricsInStory?.oldest?.id,
        oldestInStory.id,
        'oldestInStory'
      );
      assert.strictEqual(
        metricsInStory?.newest?.id,
        newestInStory.id,
        'newestInStory'
      );
      assert.strictEqual(
        metricsInStory?.oldestUnseen?.id,
        oldestStoryUnread.id,
        'oldestStoryUnread'
      );
      assert.strictEqual(metricsInStory?.totalUnseen, 1, 'totalUnseen');
    });
  });

  describe('mentionsCount & oldestUnreadMention', () => {
    it('returns unread mentions count and oldest unread mention', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const target = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();

      const readMentionsMe: Partial<MessageAttributesType> = {
        id: 'readMentionsMe',
        readStatus: ReadStatus.Read,
        mentionsMe: true,
      };
      const unreadMentionsMe: Partial<MessageAttributesType> = {
        id: 'unreadMentionsMe',
        readStatus: ReadStatus.Unread,
        mentionsMe: true,
      };
      const unreadNoMention: Partial<MessageAttributesType> = {
        id: 'unreadNoMention',
        readStatus: ReadStatus.Unread,
      };
      const unreadMentionsMeAgain: Partial<MessageAttributesType> = {
        id: 'unreadMentionsMeAgain',
        readStatus: ReadStatus.Unread,
        mentionsMe: true,
      };

      const messages = [
        readMentionsMe,
        unreadMentionsMe,
        unreadNoMention,
        unreadMentionsMeAgain,
      ];

      const formattedMessages = messages.map<MessageAttributesType>(
        (message, idx) => {
          return {
            id: generateUuid(),
            body: 'body',
            type: 'incoming',
            sent_at: target - messages.length + idx,
            received_at: target - messages.length + idx,
            timestamp: target - messages.length + idx,
            conversationId,
            ...message,
          };
        }
      );

      await saveMessages(formattedMessages, {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      assert.lengthOf(await _getAllMessages(), 4);

      const unreadMentions = await getTotalUnreadMentionsOfMeForConversation(
        conversationId,
        { includeStoryReplies: false }
      );
      const oldestUnreadMention =
        await getOldestUnreadMentionOfMeForConversation(conversationId, {
          includeStoryReplies: false,
        });

      assert.strictEqual(unreadMentions, 2);
      assert.strictEqual(oldestUnreadMention?.id, 'unreadMentionsMe');
    });
  });
});
