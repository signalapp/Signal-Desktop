// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import { DataReader, DataWriter } from '../../sql/Client';
import { generateAci } from '../../types/ServiceId';

import type { MessageAttributesType } from '../../model-types.d';

const {
  _getAllMessages,
  getMessagesWithVisualMediaAttachments,
  getMessagesWithFileAttachments,
} = DataReader;
const { removeAll, saveMessages } = DataWriter;

describe('sql/allMedia', () => {
  beforeEach(async () => {
    await removeAll();
  });

  describe('getMessagesWithVisualMediaAttachments', () => {
    it('returns messages matching with visual attachments', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();
      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: now - 20,
        received_at: now - 20,
        timestamp: now - 20,
        hasVisualMediaAttachments: true,
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
        hasVisualMediaAttachments: true,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourAci,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const searchResults = await getMessagesWithVisualMediaAttachments(
        conversationId,
        { limit: 5 }
      );
      assert.lengthOf(searchResults, 1);
      assert.strictEqual(searchResults[0].id, message1.id);
    });

    it('excludes stories and story replies', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();
      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: now - 20,
        received_at: now - 20,
        timestamp: now - 20,
        hasVisualMediaAttachments: true,
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: now - 10,
        received_at: now - 10,
        timestamp: now - 10,
        storyId: generateUuid(),
        hasVisualMediaAttachments: true,
      };
      const message3: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 3',
        type: 'story',
        conversationId,
        sent_at: now,
        received_at: now,
        timestamp: now,
        storyId: generateUuid(),
        hasVisualMediaAttachments: true,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourAci,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const searchResults = await getMessagesWithVisualMediaAttachments(
        conversationId,
        { limit: 5 }
      );
      assert.lengthOf(searchResults, 1);
      assert.strictEqual(searchResults[0].id, message1.id);
    });
  });

  describe('getMessagesWithFileAttachments', () => {
    it('returns messages matching with visual attachments', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();
      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: now - 20,
        received_at: now - 20,
        timestamp: now - 20,
        hasFileAttachments: true,
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
        hasFileAttachments: true,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourAci,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const searchResults = await getMessagesWithFileAttachments(
        conversationId,
        { limit: 5 }
      );
      assert.lengthOf(searchResults, 1);
      assert.strictEqual(searchResults[0].id, message1.id);
    });

    it('excludes stories and story replies', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();
      const message1: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: now - 20,
        received_at: now - 20,
        timestamp: now - 20,
        hasFileAttachments: true,
      };
      const message2: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: now - 10,
        received_at: now - 10,
        timestamp: now - 10,
        storyId: generateUuid(),
        hasFileAttachments: true,
      };
      const message3: MessageAttributesType = {
        id: generateUuid(),
        body: 'message 3',
        type: 'story',
        conversationId,
        sent_at: now,
        received_at: now,
        timestamp: now,
        storyId: generateUuid(),
        hasFileAttachments: true,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourAci,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const searchResults = await getMessagesWithFileAttachments(
        conversationId,
        { limit: 5 }
      );
      assert.lengthOf(searchResults, 1);
      assert.strictEqual(searchResults[0].id, message1.id);
    });
  });
});
