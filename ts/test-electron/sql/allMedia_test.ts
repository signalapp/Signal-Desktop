// Copyright 2021 Signal Messenger, LLC
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
  getMessagesWithVisualMediaAttachments,
  getMessagesWithFileAttachments,
} = dataInterface;

function getUuid(): UUIDStringType {
  return UUID.generate().toString();
}

describe('sql/allMedia', () => {
  beforeEach(async () => {
    await removeAll();
  });

  describe('getMessagesWithVisualMediaAttachments', () => {
    it('returns messages matching with visual attachments', async () => {
      assert.lengthOf(await _getAllMessages(), 0);

      const now = Date.now();
      const conversationId = getUuid();
      const ourUuid = getUuid();
      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: now - 20,
        received_at: now - 20,
        timestamp: now - 20,
        hasVisualMediaAttachments: true,
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
        hasVisualMediaAttachments: true,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourUuid,
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
      const conversationId = getUuid();
      const ourUuid = getUuid();
      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: now - 20,
        received_at: now - 20,
        timestamp: now - 20,
        hasVisualMediaAttachments: true,
      };
      const message2: MessageAttributesType = {
        id: getUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: now - 10,
        received_at: now - 10,
        timestamp: now - 10,
        storyId: getUuid(),
        hasVisualMediaAttachments: true,
      };
      const message3: MessageAttributesType = {
        id: getUuid(),
        body: 'message 3',
        type: 'story',
        conversationId,
        sent_at: now,
        received_at: now,
        timestamp: now,
        storyId: getUuid(),
        hasVisualMediaAttachments: true,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourUuid,
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
      const conversationId = getUuid();
      const ourUuid = getUuid();
      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: now - 20,
        received_at: now - 20,
        timestamp: now - 20,
        hasFileAttachments: true,
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
        hasFileAttachments: true,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourUuid,
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
      const conversationId = getUuid();
      const ourUuid = getUuid();
      const message1: MessageAttributesType = {
        id: getUuid(),
        body: 'message 1',
        type: 'outgoing',
        conversationId,
        sent_at: now - 20,
        received_at: now - 20,
        timestamp: now - 20,
        hasFileAttachments: true,
      };
      const message2: MessageAttributesType = {
        id: getUuid(),
        body: 'message 2',
        type: 'outgoing',
        conversationId,
        sent_at: now - 10,
        received_at: now - 10,
        timestamp: now - 10,
        storyId: getUuid(),
        hasFileAttachments: true,
      };
      const message3: MessageAttributesType = {
        id: getUuid(),
        body: 'message 3',
        type: 'story',
        conversationId,
        sent_at: now,
        received_at: now,
        timestamp: now,
        storyId: getUuid(),
        hasFileAttachments: true,
      };

      await saveMessages([message1, message2, message3], {
        forceSave: true,
        ourUuid,
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
