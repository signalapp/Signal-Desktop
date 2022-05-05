// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import dataInterface from '../../sql/Client';
import { UUID } from '../../types/UUID';
import type { UUIDStringType } from '../../types/UUID';

import type { MessageAttributesType } from '../../model-types.d';

const {
  removeAll,
  _getAllMessages,
  saveMessages,
  getConversationMessageStats,
} = dataInterface;

function getUuid(): UUIDStringType {
  return UUID.generate().toString();
}

describe('sql/conversationSummary', () => {
  beforeEach(async () => {
    await removeAll();
  });

  describe('getConversationMessageStats', () => {
    it('returns the latest message in current conversation', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = getUuid();
      const ourUuid = getUuid();
      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: now + 1,
        received_at: now + 1,
        timestamp: now + 1,
      };
      const message2: MessageAttributesType = {
        id: getUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: now + 2,
        received_at: now + 2,
        timestamp: now + 2,
      };
      const message3: MessageAttributesType = {
        id: getUuid(),
        body: 'message 3',
        type: 'outgoing',
        conversationId: getUuid(),
        sent_at: now + 3,
        received_at: now + 3,
        timestamp: now + 3,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourUuid,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const messages = await getConversationMessageStats({
        conversationId,
        ourUuid,
      });

      assert.strictEqual(messages.activity?.body, message2.body, 'activity');
      assert.strictEqual(messages.preview?.body, message2.body, 'preview');
      assert.isTrue(messages.hasUserInitiatedMessages);
    });

    it('returns the latest message in current conversation excluding group story replies', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = getUuid();
      const ourUuid = getUuid();
      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: now + 1,
        received_at: now + 1,
        timestamp: now + 1,
      };
      const message2: MessageAttributesType = {
        id: getUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: now + 2,
        received_at: now + 2,
        timestamp: now + 2,
        storyId: getUuid(),
      };
      const message3: MessageAttributesType = {
        id: getUuid(),
        body: 'message 3',
        type: 'incoming',
        conversationId,
        sent_at: now + 3,
        received_at: now + 3,
        timestamp: now + 3,
        storyId: getUuid(),
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourUuid,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const messages = await getConversationMessageStats({
        conversationId,
        isGroup: true,
        ourUuid,
      });

      assert.strictEqual(messages.activity?.body, message1.body, 'activity');
      assert.strictEqual(messages.preview?.body, message1.body, 'preview');
      assert.isTrue(messages.hasUserInitiatedMessages);
    });

    it('preview excludes several message types, allows type = NULL', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = getUuid();
      const ourUuid = getUuid();
      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1',
        // @ts-expect-error We're forcing a null type here for testing
        type: null,
        conversationId,
        sent_at: now + 1,
        received_at: now + 1,
        timestamp: now + 1,
      };
      const message2: MessageAttributesType = {
        id: getUuid(),
        body: 'message 2',
        type: 'change-number-notification',
        conversationId,
        sent_at: now + 2,
        received_at: now + 2,
        timestamp: now + 2,
      };
      const message3: MessageAttributesType = {
        id: getUuid(),
        body: 'message 3',
        type: 'group-v1-migration',
        conversationId,
        sent_at: now + 3,
        received_at: now + 3,
        timestamp: now + 3,
      };
      const message4: MessageAttributesType = {
        id: getUuid(),
        body: 'message 5',
        type: 'profile-change',
        conversationId,
        sent_at: now + 5,
        received_at: now + 5,
        timestamp: now + 5,
      };
      const message5: MessageAttributesType = {
        id: getUuid(),
        body: 'message 6',
        type: 'story',
        conversationId,
        sent_at: now + 6,
        received_at: now + 6,
        timestamp: now + 6,
      };
      const message6: MessageAttributesType = {
        id: getUuid(),
        body: 'message 7',
        type: 'universal-timer-notification',
        conversationId,
        sent_at: now + 7,
        received_at: now + 7,
        timestamp: now + 7,
      };
      const message7: MessageAttributesType = {
        id: getUuid(),
        body: 'message 8',
        type: 'verified-change',
        conversationId,
        sent_at: now + 8,
        received_at: now + 8,
        timestamp: now + 8,
      };

      await saveMessages(
        [message1, message2, message3, message4, message5, message6, message7],
        {
          forceSave: true,
          ourUuid,
        }
      );

      assert.lengthOf(await _getAllMessages(), 7);

      const messages = await getConversationMessageStats({
        conversationId,
        ourUuid,
      });

      assert.strictEqual(messages.preview?.body, message1.body);
    });

    it('activity excludes several message types, allows type = NULL', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = getUuid();
      const ourUuid = getUuid();
      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1',
        // @ts-expect-error We're forcing a null type here for testing
        type: null,
        conversationId,
        sent_at: now + 1,
        received_at: now + 1,
        timestamp: now + 1,
      };
      const message2: MessageAttributesType = {
        id: getUuid(),
        body: 'message 2',
        type: 'change-number-notification',
        conversationId,
        sent_at: now + 2,
        received_at: now + 2,
        timestamp: now + 2,
      };
      const message3: MessageAttributesType = {
        id: getUuid(),
        body: 'message 3',
        type: 'group-v1-migration',
        conversationId,
        sent_at: now + 3,
        received_at: now + 3,
        timestamp: now + 3,
      };
      const message4: MessageAttributesType = {
        id: getUuid(),
        body: 'message 4',
        type: 'keychange',
        conversationId,
        sent_at: now + 4,
        received_at: now + 4,
        timestamp: now + 4,
      };
      const message5: MessageAttributesType = {
        id: getUuid(),
        body: 'message 6',
        type: 'profile-change',
        conversationId,
        sent_at: now + 6,
        received_at: now + 6,
        timestamp: now + 6,
      };
      const message6: MessageAttributesType = {
        id: getUuid(),
        body: 'message 7',
        type: 'story',
        conversationId,
        sent_at: now + 7,
        received_at: now + 7,
        timestamp: now + 7,
      };
      const message7: MessageAttributesType = {
        id: getUuid(),
        body: 'message 8',
        type: 'universal-timer-notification',
        conversationId,
        sent_at: now + 8,
        received_at: now + 8,
        timestamp: now + 8,
      };
      const message8: MessageAttributesType = {
        id: getUuid(),
        body: 'message 9',
        type: 'verified-change',
        conversationId,
        sent_at: now + 9,
        received_at: now + 9,
        timestamp: now + 9,
      };

      await saveMessages(
        [
          message1,
          message2,
          message3,
          message4,
          message5,
          message6,
          message7,
          message8,
        ],
        {
          forceSave: true,
          ourUuid,
        }
      );

      assert.lengthOf(await _getAllMessages(), 8);

      const messages = await getConversationMessageStats({
        conversationId,
        ourUuid,
      });

      assert.strictEqual(messages.activity?.body, message1.body);
    });

    it('activity excludes expirationTimerUpdates with fromSync = true, includes fromSync = undefined', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = getUuid();
      const ourUuid = getUuid();
      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        expirationTimerUpdate: {
          expireTimer: 10,
          source: 'you',
        },
        sent_at: now + 1,
        received_at: now + 1,
        timestamp: now + 1,
      };
      const message2: MessageAttributesType = {
        id: getUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        expirationTimerUpdate: {
          expireTimer: 10,
          fromSync: true,
        },
        sent_at: now + 2,
        received_at: now + 2,
        timestamp: now + 2,
      };

      await saveMessages([message1, message2], {
        forceSave: true,
        ourUuid,
      });

      assert.lengthOf(await _getAllMessages(), 2);

      const messages = await getConversationMessageStats({
        conversationId,
        ourUuid,
      });

      assert.strictEqual(messages.activity?.body, message1.body);
    });

    it('activity excludes expirationTimerUpdates with fromSync = true, includes fromSync = false', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = getUuid();
      const ourUuid = getUuid();
      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        expirationTimerUpdate: {
          expireTimer: 10,
          source: 'you',
          fromSync: false,
        },
        sent_at: now + 1,
        received_at: now + 1,
        timestamp: now + 1,
      };
      const message2: MessageAttributesType = {
        id: getUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        expirationTimerUpdate: {
          expireTimer: 10,
          fromSync: true,
        },
        sent_at: now + 2,
        received_at: now + 2,
        timestamp: now + 2,
      };

      await saveMessages([message1, message2], {
        forceSave: true,
        ourUuid,
      });

      assert.lengthOf(await _getAllMessages(), 2);

      const messages = await getConversationMessageStats({
        conversationId,
        ourUuid,
      });

      assert.strictEqual(messages.activity?.body, message1.body);
    });

    it('preview excludes expired message, includes non-disappearing message', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = getUuid();
      const ourUuid = getUuid();
      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: now + 1,
        received_at: now + 1,
        timestamp: now + 1,
      };
      const message2: MessageAttributesType = {
        id: getUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        expirationStartTimestamp: now - 2 * 1000,
        expireTimer: 1,
        sent_at: now + 2,
        received_at: now + 2,
        timestamp: now + 2,
      };

      await saveMessages([message1, message2], {
        forceSave: true,
        ourUuid,
      });

      assert.lengthOf(await _getAllMessages(), 2);

      const messages = await getConversationMessageStats({
        conversationId,
        ourUuid,
      });

      assert.strictEqual(messages.preview?.body, message1.body);
    });

    it('preview excludes expired message, includes non-disappearing message', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = getUuid();
      const ourUuid = getUuid();
      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        expirationStartTimestamp: now,
        expireTimer: 30,
        sent_at: now + 1,
        received_at: now + 1,
        timestamp: now + 1,
      };
      const message2: MessageAttributesType = {
        id: getUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        expirationStartTimestamp: now - 2 * 1000,
        expireTimer: 1,
        sent_at: now + 2,
        received_at: now + 2,
        timestamp: now + 2,
      };

      await saveMessages([message1, message2], {
        forceSave: true,
        ourUuid,
      });

      assert.lengthOf(await _getAllMessages(), 2);

      const messages = await getConversationMessageStats({
        conversationId,
        ourUuid,
      });

      assert.strictEqual(messages.preview?.body, message1.body);
    });

    it('excludes group v2 change events where someone else leaves a group', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = getUuid();
      const otherUuid = getUuid();
      const ourUuid = getUuid();
      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1 - removing ourselves',
        type: 'group-v2-change',
        conversationId,
        groupV2Change: {
          from: ourUuid,
          details: [
            {
              type: 'member-remove',
              uuid: ourUuid,
            },
          ],
        },
        sent_at: now + 1,
        received_at: now + 1,
        timestamp: now + 1,
      };
      const message2: MessageAttributesType = {
        id: getUuid(),
        body: 'message 2 - someone else leaving',
        type: 'group-v2-change',
        conversationId,
        groupV2Change: {
          from: otherUuid,
          details: [
            {
              type: 'member-remove',
              uuid: otherUuid,
            },
          ],
        },
        sent_at: now + 2,
        received_at: now + 2,
        timestamp: now + 2,
      };

      await saveMessages([message1, message2], {
        forceSave: true,
        ourUuid,
      });

      assert.lengthOf(await _getAllMessages(), 2);

      const messages = await getConversationMessageStats({
        conversationId,
        ourUuid,
      });

      assert.strictEqual(messages.activity?.body, message1.body, 'activity');
      assert.strictEqual(messages.preview?.body, message1.body, 'preview');
      assert.isFalse(messages.hasUserInitiatedMessages);
    });
  });
});
