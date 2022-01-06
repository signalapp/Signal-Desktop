// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import dataInterface from '../../sql/Client';
import { UUID } from '../../types/UUID';
import type { UUIDStringType } from '../../types/UUID';

import type { MessageAttributesType } from '../../model-types.d';
import { ReadStatus } from '../../messages/MessageReadStatus';

const {
  removeAll,
  _getAllMessages,
  saveMessages,
  getMessageMetricsForConversation,
  getNewerMessagesByConversation,
  getOlderMessagesByConversation,
} = dataInterface;

function getUuid(): UUIDStringType {
  return UUID.generate().toString();
}

describe('sql/timelineFetches', () => {
  beforeEach(async () => {
    await removeAll();
  });

  describe('getOlderMessagesByConversation', () => {
    it('returns N most recent messages', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = getUuid();
      const storyId = getUuid();
      const ourUuid = getUuid();

      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: now - 20,
        received_at: now - 20,
        timestamp: now - 20,
      };
      const message2: MessageAttributesType = {
        id: getUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: now - 10,
        received_at: now - 10,
        timestamp: now - 10,
      };
      const message3: MessageAttributesType = {
        id: getUuid(),
        body: 'message 3',
        type: 'outgoing',
        conversationId: getUuid(),
        sent_at: now,
        received_at: now,
        timestamp: now,
      };
      const message4: MessageAttributesType = {
        id: getUuid(),
        body: 'message 4',
        type: 'story',
        conversationId,
        sent_at: now,
        received_at: now,
        timestamp: now,
        storyId,
      };
      const message5: MessageAttributesType = {
        id: getUuid(),
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
        ourUuid,
      });

      assert.lengthOf(await _getAllMessages(), 5);

      const messages = await getOlderMessagesByConversation(conversationId, {
        limit: 5,
      });
      assert.lengthOf(messages, 2);

      // Fetched with DESC query, but with reverse() call afterwards
      assert.strictEqual(messages[0].id, message1.id);
      assert.strictEqual(messages[1].id, message2.id);
    });

    it('returns N most recent messages for a given story', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = getUuid();
      const storyId = getUuid();
      const ourUuid = getUuid();

      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'story',
        type: 'story',
        conversationId,
        sent_at: now - 20,
        received_at: now - 20,
        timestamp: now - 20,
        storyId,
      };
      const message2: MessageAttributesType = {
        id: getUuid(),
        body: 'story reply 1',
        type: 'outgoing',
        conversationId,
        sent_at: now - 10,
        received_at: now - 10,
        timestamp: now - 10,
        storyId,
      };
      const message3: MessageAttributesType = {
        id: getUuid(),
        body: 'normal message',
        type: 'outgoing',
        conversationId,
        sent_at: now,
        received_at: now,
        timestamp: now,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourUuid,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const messages = await getOlderMessagesByConversation(conversationId, {
        limit: 5,
        storyId,
      });
      assert.lengthOf(messages, 1);
      assert.strictEqual(messages[0].id, message2.id);
    });

    it('returns N messages older than provided received_at', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const target = Date.now();
      const conversationId = getUuid();
      const ourUuid = getUuid();

      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: target - 10,
        received_at: target - 10,
        timestamp: target - 10,
      };
      const message2: MessageAttributesType = {
        id: getUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: target,
        received_at: target,
        timestamp: target,
      };
      const message3: MessageAttributesType = {
        id: getUuid(),
        body: 'message 3',
        type: 'outgoing',
        conversationId,
        sent_at: target + 10,
        received_at: target + 10,
        timestamp: target + 10,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourUuid,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const messages = await getOlderMessagesByConversation(conversationId, {
        limit: 5,
        receivedAt: target,
        sentAt: target,
      });
      assert.lengthOf(messages, 1);
      assert.strictEqual(messages[0].id, message1.id);
    });

    it('returns N older messages with received_at, lesser sent_at', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const target = Date.now();
      const conversationId = getUuid();
      const ourUuid = getUuid();

      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: target - 20,
        received_at: target,
        timestamp: target,
      };
      const message2: MessageAttributesType = {
        id: getUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: target - 10,
        received_at: target,
        timestamp: target,
      };
      const message3: MessageAttributesType = {
        id: getUuid(),
        body: 'message 3',
        type: 'outgoing',
        conversationId,
        sent_at: target,
        received_at: target,
        timestamp: target,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourUuid,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const messages = await getOlderMessagesByConversation(conversationId, {
        limit: 5,
        receivedAt: target,
        sentAt: target,
      });

      assert.lengthOf(messages, 2);

      // Fetched with DESC query, but with reverse() call afterwards
      assert.strictEqual(messages[0].id, message1.id, 'checking message 1');
      assert.strictEqual(messages[1].id, message2.id, 'checking message 2');
    });

    it('returns N older messages, same received_at/sent_at but excludes messageId', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const target = Date.now();
      const conversationId = getUuid();
      const ourUuid = getUuid();

      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: target - 10,
        received_at: target,
        timestamp: target,
      };
      const message2: MessageAttributesType = {
        id: getUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: target - 10,
        received_at: target,
        timestamp: target,
      };
      const message3: MessageAttributesType = {
        id: getUuid(),
        body: 'message 3',
        type: 'outgoing',
        conversationId,
        sent_at: target,
        received_at: target,
        timestamp: target,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourUuid,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const messages = await getOlderMessagesByConversation(conversationId, {
        limit: 5,
        receivedAt: target,
        sentAt: target,
        messageId: message2.id,
      });

      assert.lengthOf(messages, 1);
      assert.strictEqual(messages[0].id, message1.id);
    });
  });

  describe('getNewerMessagesByConversation', () => {
    it('returns N oldest messages with no parameters', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = getUuid();
      const storyId = getUuid();
      const ourUuid = getUuid();

      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId: getUuid(),
        sent_at: now,
        received_at: now,
        timestamp: now,
      };
      const message2: MessageAttributesType = {
        id: getUuid(),
        body: 'message 2',
        type: 'story',
        conversationId,
        sent_at: now,
        received_at: now,
        timestamp: now,
        storyId,
      };
      const message3: MessageAttributesType = {
        id: getUuid(),
        body: 'message 3',
        type: 'outgoing',
        conversationId,
        sent_at: now,
        received_at: now,
        timestamp: now,
        storyId,
      };
      const message4: MessageAttributesType = {
        id: getUuid(),
        body: 'message 4',
        type: 'outgoing',
        conversationId,
        sent_at: now + 10,
        received_at: now + 10,
        timestamp: now + 10,
      };
      const message5: MessageAttributesType = {
        id: getUuid(),
        body: 'message 5',
        type: 'outgoing',
        conversationId,
        sent_at: now + 20,
        received_at: now + 20,
        timestamp: now + 20,
      };

      await saveMessages([message1, message2, message3, message4, message5], {
        forceSave: true,
        ourUuid,
      });

      assert.lengthOf(await _getAllMessages(), 5);

      const messages = await getNewerMessagesByConversation(conversationId, {
        limit: 5,
      });

      assert.lengthOf(messages, 2);
      assert.strictEqual(messages[0].id, message4.id, 'checking message 4');
      assert.strictEqual(messages[1].id, message5.id, 'checking message 5');
    });

    it('returns N oldest messages for a given story with no parameters', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = getUuid();
      const storyId = getUuid();
      const ourUuid = getUuid();

      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1',
        type: 'story',
        conversationId,
        sent_at: now,
        received_at: now,
        timestamp: now,
        storyId,
      };
      const message2: MessageAttributesType = {
        id: getUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: now + 10,
        received_at: now + 10,
        timestamp: now + 10,
        storyId,
      };
      const message3: MessageAttributesType = {
        id: getUuid(),
        body: 'message 3',
        type: 'outgoing',
        conversationId,
        sent_at: now + 20,
        received_at: now + 20,
        timestamp: now + 20,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourUuid,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const messages = await getNewerMessagesByConversation(conversationId, {
        limit: 5,
        storyId,
      });

      assert.lengthOf(messages, 1);
      assert.strictEqual(messages[0].id, message2.id);
    });

    it('returns N messages newer than provided received_at', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const target = Date.now();
      const conversationId = getUuid();
      const ourUuid = getUuid();

      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: target - 10,
        received_at: target - 10,
        timestamp: target - 10,
      };
      const message2: MessageAttributesType = {
        id: getUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: target,
        received_at: target,
        timestamp: target,
      };
      const message3: MessageAttributesType = {
        id: getUuid(),
        body: 'message 3',
        type: 'outgoing',
        conversationId,
        sent_at: target + 10,
        received_at: target + 10,
        timestamp: target + 10,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourUuid,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const messages = await getNewerMessagesByConversation(conversationId, {
        limit: 5,
        receivedAt: target,
        sentAt: target,
      });
      assert.lengthOf(messages, 1);
      assert.strictEqual(messages[0].id, message3.id);
    });

    it('returns N newer messages with same received_at, greater sent_at', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const target = Date.now();
      const conversationId = getUuid();
      const ourUuid = getUuid();

      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: target,
        received_at: target,
        timestamp: target,
      };
      const message2: MessageAttributesType = {
        id: getUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: target + 10,
        received_at: target,
        timestamp: target,
      };
      const message3: MessageAttributesType = {
        id: getUuid(),
        body: 'message 3',
        type: 'outgoing',
        conversationId,
        sent_at: target + 20,
        received_at: target,
        timestamp: target,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourUuid,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const messages = await getNewerMessagesByConversation(conversationId, {
        limit: 5,
        receivedAt: target,
        sentAt: target,
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
      const conversationId = getUuid();
      const storyId = getUuid();
      const ourUuid = getUuid();

      const story: MessageAttributesType = {
        id: getUuid(),
        body: 'story',
        type: 'story',
        conversationId,
        sent_at: target - 10,
        received_at: target - 10,
        timestamp: target - 10,
      };
      const oldestInStory: MessageAttributesType = {
        id: getUuid(),
        body: 'oldestInStory',
        type: 'outgoing',
        conversationId,
        sent_at: target - 9,
        received_at: target - 9,
        timestamp: target - 9,
        storyId,
      };
      const oldest: MessageAttributesType = {
        id: getUuid(),
        body: 'oldest',
        type: 'outgoing',
        conversationId,
        sent_at: target - 8,
        received_at: target - 8,
        timestamp: target - 8,
      };
      const oldestUnread: MessageAttributesType = {
        id: getUuid(),
        body: 'oldestUnread',
        type: 'incoming',
        conversationId,
        sent_at: target - 7,
        received_at: target - 7,
        timestamp: target - 7,
        readStatus: ReadStatus.Unread,
      };
      const oldestStoryUnread: MessageAttributesType = {
        id: getUuid(),
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
        id: getUuid(),
        body: 'anotherUnread',
        type: 'incoming',
        conversationId,
        sent_at: target - 5,
        received_at: target - 5,
        timestamp: target - 5,
        readStatus: ReadStatus.Unread,
      };
      const newestInStory: MessageAttributesType = {
        id: getUuid(),
        body: 'newestStory',
        type: 'outgoing',
        conversationId,
        sent_at: target - 4,
        received_at: target - 4,
        timestamp: target - 4,
        storyId,
      };
      const newest: MessageAttributesType = {
        id: getUuid(),
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
          oldestUnread,
          oldestStoryUnread,
          anotherUnread,
          newestInStory,
          newest,
        ],
        { forceSave: true, ourUuid }
      );

      assert.lengthOf(await _getAllMessages(), 8);

      const metricsInTimeline = await getMessageMetricsForConversation(
        conversationId
      );
      assert.strictEqual(metricsInTimeline?.oldest?.id, oldest.id, 'oldest');
      assert.strictEqual(metricsInTimeline?.newest?.id, newest.id, 'newest');
      assert.strictEqual(
        metricsInTimeline?.oldestUnread?.id,
        oldestUnread.id,
        'oldestUnread'
      );
      assert.strictEqual(metricsInTimeline?.totalUnread, 2, 'totalUnread');

      const metricsInStory = await getMessageMetricsForConversation(
        conversationId,
        storyId
      );
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
        metricsInStory?.oldestUnread?.id,
        oldestStoryUnread.id,
        'oldestStoryUnread'
      );
      assert.strictEqual(metricsInStory?.totalUnread, 1, 'totalUnread');
    });
  });
});
