// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as uuid } from 'uuid';
import { MessageModel } from '../../models/messages';
import { strictAssert } from '../../util/assert';

import { MessageCache } from '../../services/MessageCache';
import { generateAci } from '../../types/ServiceId';

describe('MessageCache', () => {
  beforeEach(async () => {
    const ourAci = generateAci();
    await window.textsecure.storage.put('uuid_id', `${ourAci}.1`);
    await window.ConversationController.load();
  });

  describe('findBySentAt', () => {
    it('returns an empty iterable if no messages match', async () => {
      const mc = new MessageCache();

      assert.isUndefined(await mc.findBySentAt(123, () => true));
    });

    it('returns all messages that match the timestamp', async () => {
      const mc = new MessageCache();

      let message1 = new MessageModel({
        conversationId: 'xyz',
        body: 'message1',
        id: uuid(),
        received_at: 1,
        sent_at: 1234,
        timestamp: 9999,
        type: 'incoming',
      });
      let message2 = new MessageModel({
        conversationId: 'xyz',
        body: 'message2',
        id: uuid(),
        received_at: 2,
        sent_at: 1234,
        timestamp: 9999,
        type: 'outgoing',
      });
      const message3 = new MessageModel({
        conversationId: 'xyz',
        body: 'message3',
        id: uuid(),
        received_at: 3,
        sent_at: 5678,
        timestamp: 9999,
        type: 'outgoing',
      });

      message1 = mc.register(message1);
      message2 = mc.register(message2);
      // We deliberately register this message twice for testing.
      message2 = mc.register(message2);
      mc.register(message3);

      const filteredMessage = await mc.findBySentAt(1234, () => true);

      assert.deepEqual(
        filteredMessage?.attributes,
        message1.attributes,
        'first'
      );

      mc.unregister(message1.id);

      const filteredMessage2 = await mc.findBySentAt(1234, () => true);

      assert.deepEqual(
        filteredMessage2?.attributes,
        message2.attributes,
        'second'
      );
    });
  });

  describe('register: syncing with backbone', () => {
    it('backbone to redux', () => {
      const message1 = new MessageModel({
        conversationId: 'xyz',
        id: uuid(),
        body: 'test1',
        received_at: 1,
        sent_at: Date.now(),
        timestamp: Date.now(),
        type: 'outgoing',
      });
      const messageFromController = window.MessageCache.register(message1);

      assert.strictEqual(
        message1,
        messageFromController,
        'same objects from mc.register'
      );

      const messageInCache = window.MessageCache.getById(message1.id);
      assert.strictEqual(
        message1,
        messageInCache,
        'same objects from mc.getById'
      );
      assert.deepEqual(
        message1.attributes,
        messageInCache?.attributes,
        'same attributes as in cache'
      );

      message1.set({ body: 'test2' });
      assert.equal(message1.attributes.body, 'test2', 'message model updated');
      assert.equal(
        messageInCache?.attributes.body,
        'test2',
        'old reference from messageById was updated'
      );
    });

    it('redux to backbone (working with models)', () => {
      const message = new MessageModel({
        conversationId: 'xyz',
        id: uuid(),
        body: 'test1',
        received_at: 1,
        sent_at: Date.now(),
        timestamp: Date.now(),
        type: 'outgoing',
      });

      const messageFromController = window.MessageCache.register(message);

      assert.strictEqual(
        message,
        messageFromController,
        'mc.register returns existing but it is not the same reference'
      );
      assert.deepEqual(
        message.attributes,
        messageFromController.attributes,
        'mc.register returns existing and is the same attributes'
      );

      message.set({ body: 'test2' });

      const messageInCache = window.MessageCache.getById(message.id);
      strictAssert(messageInCache, 'no message found');
      assert.equal(
        messageFromController.get('body'),
        messageInCache.get('body'),
        'new update is in cache'
      );
    });
  });
});
