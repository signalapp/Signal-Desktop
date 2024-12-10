// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as uuid } from 'uuid';
import type { MessageAttributesType } from '../../model-types.d';
import { DataReader, DataWriter } from '../../sql/Client';
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

      message1 = mc.__DEPRECATED$register(message1.id, message1, 'test');
      message2 = mc.__DEPRECATED$register(message2.id, message2, 'test');
      // We deliberately register this message twice for testing.
      message2 = mc.__DEPRECATED$register(message2.id, message2, 'test');
      mc.__DEPRECATED$register(message3.id, message3, 'test');

      const filteredMessage = await mc.findBySentAt(1234, () => true);

      assert.deepEqual(filteredMessage, message1.attributes, 'first');

      mc.__DEPRECATED$unregister(message1.id);

      const filteredMessage2 = await mc.findBySentAt(1234, () => true);

      assert.deepEqual(filteredMessage2, message2.attributes, 'second');
    });
  });

  describe('__DEPRECATED$register: syncing with backbone', () => {
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
      const messageFromController = window.MessageCache.__DEPRECATED$register(
        message1.id,
        message1,
        'test'
      );

      assert.strictEqual(
        message1,
        messageFromController,
        'same objects from mc.__DEPRECATED$register'
      );

      const messageById = window.MessageCache.__DEPRECATED$getById(
        message1.id,
        'test'
      );

      assert.strictEqual(message1, messageById, 'same objects from mc.getById');

      const messageInCache = window.MessageCache.accessAttributes(message1.id);
      strictAssert(messageInCache, 'no message found');
      assert.deepEqual(
        message1.attributes,
        messageInCache,
        'same attributes as in cache'
      );

      message1.set({ body: 'test2' });
      assert.equal(message1.attributes.body, 'test2', 'message model updated');
      assert.equal(
        messageById?.attributes.body,
        'test2',
        'old reference from messageById was updated'
      );
      assert.equal(
        messageInCache.body,
        'test1',
        'old cache reference not updated'
      );

      const newMessageById = window.MessageCache.__DEPRECATED$getById(
        message1.id,
        'test'
      );
      assert.deepEqual(
        message1.attributes,
        newMessageById?.attributes,
        'same attributes from mc.getById (2)'
      );

      const newMessageInCache = window.MessageCache.accessAttributes(
        message1.id
      );
      strictAssert(newMessageInCache, 'no message found');
      assert.deepEqual(
        message1.attributes,
        newMessageInCache,
        'same attributes as in cache (2)'
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

      window.MessageCache.toMessageAttributes(message.attributes);

      const messageFromController = window.MessageCache.__DEPRECATED$register(
        message.id,
        message,
        'test'
      );

      assert.notStrictEqual(
        message,
        messageFromController,
        'mc.__DEPRECATED$register returns existing but it is not the same reference'
      );
      assert.deepEqual(
        message.attributes,
        messageFromController.attributes,
        'mc.__DEPRECATED$register returns existing and is the same attributes'
      );

      messageFromController.set({ body: 'test2' });

      assert.notEqual(
        message.get('body'),
        messageFromController.get('body'),
        'new model is not equal to old model'
      );

      const messageInCache = window.MessageCache.accessAttributes(message.id);
      strictAssert(messageInCache, 'no message found');
      assert.equal(
        messageFromController.get('body'),
        messageInCache.body,
        'new update is in cache'
      );

      assert.isUndefined(
        messageFromController.get('storyReplyContext'),
        'storyReplyContext is undefined'
      );

      window.MessageCache.setAttributes({
        messageId: message.id,
        messageAttributes: {
          storyReplyContext: {
            attachment: undefined,
            authorAci: undefined,
            messageId: 'test123',
          },
        },
        skipSaveToDatabase: true,
      });

      // This works because we refresh the model whenever an attribute changes
      // but this should log a warning.
      assert.equal(
        messageFromController.get('storyReplyContext')?.messageId,
        'test123',
        'storyReplyContext was updated (stale model)'
      );

      const newMessageFromController =
        window.MessageCache.__DEPRECATED$register(message.id, message, 'test');

      assert.equal(
        newMessageFromController.get('storyReplyContext')?.messageId,
        'test123',
        'storyReplyContext was updated (not stale)'
      );
    });

    it('redux to backbone (working with attributes)', () => {
      it('sets the attributes and returns a fresh copy', () => {
        const mc = new MessageCache();

        const messageAttributes: MessageAttributesType = {
          conversationId: uuid(),
          id: uuid(),
          received_at: 1,
          sent_at: Date.now(),
          timestamp: Date.now(),
          type: 'incoming',
        };

        const messageModel = mc.__DEPRECATED$register(
          messageAttributes.id,
          messageAttributes,
          'test/updateAttributes'
        );

        assert.deepEqual(
          messageAttributes,
          messageModel.attributes,
          'initial attributes matches message model'
        );

        const proposedStoryReplyContext = {
          attachment: undefined,
          authorAci: undefined,
          messageId: 'test123',
        };

        assert.notDeepEqual(
          messageModel.attributes.storyReplyContext,
          proposedStoryReplyContext,
          'attributes were changed outside of the message model'
        );

        mc.setAttributes({
          messageId: messageAttributes.id,
          messageAttributes: {
            storyReplyContext: proposedStoryReplyContext,
          },
          skipSaveToDatabase: true,
        });

        const nextMessageAttributes = mc.accessAttributesOrThrow(
          'test',
          messageAttributes.id
        );

        assert.notDeepEqual(
          messageAttributes,
          nextMessageAttributes,
          'initial attributes are stale'
        );
        assert.notDeepEqual(
          messageAttributes.storyReplyContext,
          proposedStoryReplyContext,
          'initial attributes are stale 2'
        );

        assert.deepEqual(
          nextMessageAttributes.storyReplyContext,
          proposedStoryReplyContext,
          'fresh attributes match what was proposed'
        );
        assert.notStrictEqual(
          nextMessageAttributes.storyReplyContext,
          proposedStoryReplyContext,
          'fresh attributes are not the same reference as proposed attributes'
        );

        assert.deepEqual(
          messageModel.attributes,
          nextMessageAttributes,
          'model was updated'
        );

        assert.equal(
          messageModel.get('storyReplyContext')?.messageId,
          'test123',
          'storyReplyContext in model is set correctly'
        );
      });
    });
  });

  describe('accessAttributes', () => {
    it('gets the attributes if they exist', () => {
      const mc = new MessageCache();

      const messageAttributes: MessageAttributesType = {
        conversationId: uuid(),
        id: uuid(),
        received_at: 1,
        sent_at: Date.now(),
        timestamp: Date.now(),
        type: 'incoming',
      };

      mc.toMessageAttributes(messageAttributes);

      const accessAttributes = mc.accessAttributes(messageAttributes.id);

      assert.deepEqual(
        accessAttributes,
        messageAttributes,
        'attributes returned have the same values'
      );
      assert.notStrictEqual(
        accessAttributes,
        messageAttributes,
        'attributes returned are not the same references'
      );

      const undefinedMessage = mc.accessAttributes(uuid());
      assert.isUndefined(undefinedMessage, 'access did not find message');
    });
  });

  describe('setAttributes', () => {
    it('saves the new attributes to the database', async () => {
      const mc = new MessageCache();

      const ourAci = generateAci();
      const id = uuid();
      const messageAttributes: MessageAttributesType = {
        conversationId: uuid(),
        id,
        received_at: 1,
        sent_at: Date.now(),
        timestamp: Date.now(),
        type: 'incoming',
      };
      await DataWriter.saveMessage(messageAttributes, {
        forceSave: true,
        ourAci,
      });

      const changes = {
        received_at: 2,
      };
      const newAttributes = {
        ...messageAttributes,
        ...changes,
      };

      mc.toMessageAttributes(messageAttributes);

      await mc.setAttributes({
        messageId: id,
        messageAttributes: changes,
        skipSaveToDatabase: false,
      });

      const messageFromDatabase = await DataReader.getMessageById(id);

      assert.deepEqual(newAttributes, messageFromDatabase);
    });
  });

  describe('accessAttributesOrThrow', () => {
    it('accesses the attributes or throws if they do not exist', () => {
      const mc = new MessageCache();

      const messageAttributes: MessageAttributesType = {
        conversationId: uuid(),
        id: uuid(),
        received_at: 1,
        sent_at: Date.now(),
        timestamp: Date.now(),
        type: 'incoming',
      };

      mc.toMessageAttributes(messageAttributes);

      const accessAttributes = mc.accessAttributesOrThrow(
        'tests.1',
        messageAttributes.id
      );

      assert.deepEqual(
        accessAttributes,
        messageAttributes,
        'attributes returned have the same values'
      );
      assert.notStrictEqual(
        accessAttributes,
        messageAttributes,
        'attributes returned are not the same references'
      );

      assert.throws(() => {
        mc.accessAttributesOrThrow('tests.2', uuid());
      });
    });
  });
});
