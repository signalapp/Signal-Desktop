// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import { DataReader, DataWriter } from '../../sql/Client';
import { generateAci } from '../../types/ServiceId';
import { DurationInSeconds } from '../../util/durations';

import type { MessageAttributesType } from '../../model-types.d';
import { postSaveUpdates } from '../../util/cleanup';

const { _getAllMessages, getConversationMessageStats } = DataReader;
const { removeAll, saveMessages } = DataWriter;

describe('sql/conversationSummary', () => {
  beforeEach(async () => {
    await removeAll();
  });

  describe('getConversationMessageStats', () => {
    it('returns the latest message in current conversation', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();
      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: now + 1,
        received_at: now + 1,
        timestamp: now + 1,
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: now + 2,
        received_at: now + 2,
        timestamp: now + 2,
      };
      const message3: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 3',
        type: 'outgoing',
        conversationId: generateUuid(),
        sent_at: now + 3,
        received_at: now + 3,
        timestamp: now + 3,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const messages = await getConversationMessageStats({
        conversationId,
        includeStoryReplies: false,
      });

      assert.strictEqual(messages.activity?.body, message2.body, 'activity');
      assert.strictEqual(messages.preview?.body, message2.body, 'preview');
      assert.isTrue(messages.hasUserInitiatedMessages);
    });

    it('returns the latest message in current conversation excluding group story replies', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();
      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: now + 1,
        received_at: now + 1,
        timestamp: now + 1,
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: now + 2,
        received_at: now + 2,
        timestamp: now + 2,
        storyId: generateUuid(),
      };
      const message3: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 3',
        type: 'incoming',
        conversationId,
        sent_at: now + 3,
        received_at: now + 3,
        timestamp: now + 3,
        storyId: generateUuid(),
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const messages = await getConversationMessageStats({
        conversationId,
        includeStoryReplies: false,
      });

      assert.strictEqual(messages.activity?.body, message1.body, 'activity');
      assert.strictEqual(messages.preview?.body, message1.body, 'preview');
      assert.isTrue(messages.hasUserInitiatedMessages);
    });

    it('preview excludes several message types, allows type = NULL', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();
      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1',
        // @ts-expect-error We're forcing a null type here for testing
        type: null,
        conversationId,
        sent_at: now + 1,
        received_at: now + 1,
        timestamp: now + 1,
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 2',
        type: 'change-number-notification',
        conversationId,
        sent_at: now + 2,
        received_at: now + 2,
        timestamp: now + 2,
      };
      const message3: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 3',
        type: 'group-v1-migration',
        conversationId,
        sent_at: now + 3,
        received_at: now + 3,
        timestamp: now + 3,
      };
      const message4: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 5',
        type: 'profile-change',
        conversationId,
        sent_at: now + 5,
        received_at: now + 5,
        timestamp: now + 5,
      };
      const message5: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 6',
        type: 'story',
        conversationId,
        sent_at: now + 6,
        received_at: now + 6,
        timestamp: now + 6,
      };
      const message6: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 7',
        type: 'universal-timer-notification',
        conversationId,
        sent_at: now + 7,
        received_at: now + 7,
        timestamp: now + 7,
      };
      const message7: MessageAttributesType = {
        id: generateUuid(),
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
          ourAci,
          postSaveUpdates,
        }
      );

      assert.lengthOf(await _getAllMessages(), 7);

      const messages = await getConversationMessageStats({
        conversationId,
        includeStoryReplies: false,
      });

      assert.strictEqual(messages.preview?.body, message1.body);
    });

    it('activity excludes several message types, allows type = NULL', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();
      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1',
        // @ts-expect-error We're forcing a null type here for testing
        type: null,
        conversationId,
        sent_at: now + 1,
        received_at: now + 1,
        timestamp: now + 1,
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 2',
        type: 'change-number-notification',
        conversationId,
        sent_at: now + 2,
        received_at: now + 2,
        timestamp: now + 2,
      };
      const message3: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 3',
        type: 'group-v1-migration',
        conversationId,
        sent_at: now + 3,
        received_at: now + 3,
        timestamp: now + 3,
      };
      const message4: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 4',
        type: 'keychange',
        conversationId,
        sent_at: now + 4,
        received_at: now + 4,
        timestamp: now + 4,
      };
      const message5: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 6',
        type: 'profile-change',
        conversationId,
        sent_at: now + 6,
        received_at: now + 6,
        timestamp: now + 6,
      };
      const message6: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 7',
        type: 'story',
        conversationId,
        sent_at: now + 7,
        received_at: now + 7,
        timestamp: now + 7,
      };
      const message7: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 8',
        type: 'universal-timer-notification',
        conversationId,
        sent_at: now + 8,
        received_at: now + 8,
        timestamp: now + 8,
      };
      const message8: MessageAttributesType = {
        id: generateUuid(),
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
          ourAci,
          postSaveUpdates,
        }
      );

      assert.lengthOf(await _getAllMessages(), 8);

      const messages = await getConversationMessageStats({
        conversationId,
        includeStoryReplies: false,
      });

      assert.strictEqual(messages.activity?.body, message1.body);
    });

    it('activity excludes expirationTimerUpdates with fromSync = true, includes fromSync = undefined', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();
      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        expirationTimerUpdate: {
          expireTimer: DurationInSeconds.fromSeconds(10),
          source: 'you',
        },
        sent_at: now + 1,
        received_at: now + 1,
        timestamp: now + 1,
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        expirationTimerUpdate: {
          expireTimer: DurationInSeconds.fromSeconds(10),
          fromSync: true,
        },
        sent_at: now + 2,
        received_at: now + 2,
        timestamp: now + 2,
      };

      await saveMessages([message1, message2], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      assert.lengthOf(await _getAllMessages(), 2);

      const messages = await getConversationMessageStats({
        conversationId,
        includeStoryReplies: false,
      });

      assert.strictEqual(messages.activity?.body, message1.body);
    });

    it('activity excludes expirationTimerUpdates with fromSync = true, includes fromSync = false', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();
      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        expirationTimerUpdate: {
          expireTimer: DurationInSeconds.fromSeconds(10),
          source: 'you',
          fromSync: false,
        },
        sent_at: now + 1,
        received_at: now + 1,
        timestamp: now + 1,
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        expirationTimerUpdate: {
          expireTimer: DurationInSeconds.fromSeconds(10),
          fromSync: true,
        },
        sent_at: now + 2,
        received_at: now + 2,
        timestamp: now + 2,
      };

      await saveMessages([message1, message2], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      assert.lengthOf(await _getAllMessages(), 2);

      const messages = await getConversationMessageStats({
        conversationId,
        includeStoryReplies: false,
      });

      assert.strictEqual(messages.activity?.body, message1.body);
    });

    it('preview excludes expired message, includes non-disappearing message', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();
      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: now + 1,
        received_at: now + 1,
        timestamp: now + 1,
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        expirationStartTimestamp: now - 2 * 1000,
        expireTimer: DurationInSeconds.fromSeconds(1),
        sent_at: now + 2,
        received_at: now + 2,
        timestamp: now + 2,
      };

      await saveMessages([message1, message2], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      assert.lengthOf(await _getAllMessages(), 2);

      const messages = await getConversationMessageStats({
        conversationId,
        includeStoryReplies: false,
      });

      assert.strictEqual(messages.preview?.body, message1.body);
    });

    it('preview excludes expired message, includes non-disappearing message', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();
      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        expirationStartTimestamp: now,
        expireTimer: DurationInSeconds.fromSeconds(30),
        sent_at: now + 1,
        received_at: now + 1,
        timestamp: now + 1,
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        expirationStartTimestamp: now - 2 * 1000,
        expireTimer: DurationInSeconds.fromSeconds(1),
        sent_at: now + 2,
        received_at: now + 2,
        timestamp: now + 2,
      };

      await saveMessages([message1, message2], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      assert.lengthOf(await _getAllMessages(), 2);

      const messages = await getConversationMessageStats({
        conversationId,
        includeStoryReplies: false,
      });

      assert.strictEqual(messages.preview?.body, message1.body);
    });

    it('excludes group v2 change events where someone else leaves a group', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = generateUuid();
      const otherServiceId = generateAci();
      const ourAci = generateAci();
      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1 - removing ourselves',
        type: 'group-v2-change',
        conversationId,
        groupV2Change: {
          from: ourAci,
          details: [
            {
              type: 'member-remove',
              aci: ourAci,
            },
          ],
        },
        sent_at: now + 1,
        received_at: now + 1,
        timestamp: now + 1,
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 2 - someone else leaving',
        type: 'group-v2-change',
        conversationId,
        groupV2Change: {
          from: otherServiceId,
          details: [
            {
              type: 'member-remove',
              aci: otherServiceId,
            },
          ],
        },
        sent_at: now + 2,
        received_at: now + 2,
        timestamp: now + 2,
      };

      await saveMessages([message1, message2], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      assert.lengthOf(await _getAllMessages(), 2);

      const messages = await getConversationMessageStats({
        conversationId,
        includeStoryReplies: false,
      });

      assert.strictEqual(messages.activity?.body, message1.body, 'activity');
      assert.strictEqual(messages.preview?.body, message1.body, 'preview');
      assert.isFalse(messages.hasUserInitiatedMessages);
    });
  });
});
