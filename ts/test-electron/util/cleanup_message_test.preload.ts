// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v7 } from 'uuid';
import { assert } from 'chai';
import { emptyDir, ensureFile, readdirSync } from 'fs-extra';

import {
  eraseMessageContents,
  cleanupFilesAndReferencesToMessage,
} from '../../util/cleanup.preload.js';
import { MessageModel } from '../../models/messages.preload.js';
import type { PollMessageAttribute } from '../../types/Polls.dom.js';
import { DataReader, DataWriter } from '../../sql/Client.preload.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';
import { generateAci } from '../../types/ServiceId.std.js';
import type { MessageAttributesType } from '../../model-types.js';
import { IMAGE_BMP, IMAGE_JPEG } from '../../types/MIME.std.js';
import { SendStatus } from '../../messages/MessageSendState.std.js';
import { getAbsoluteAttachmentPath } from '../../util/migrations.preload.js';
import { getAttachmentsPath } from '../../../app/attachments.node.js';

async function writeAttachmentFile(path: string) {
  await ensureFile(getAbsoluteAttachmentPath(path));
}

function listAttachmentFiles(): Array<string> {
  return readdirSync(
    getAttachmentsPath(window.SignalContext.config.userDataPath)
  );
}

describe('cleanupMessage', () => {
  beforeEach(async () => {
    await DataWriter.removeAll();
    await itemStorage.user.setAciAndDeviceId(generateAci(), 1);
    await emptyDir(
      getAttachmentsPath(window.SignalContext.config.userDataPath)
    );
    await window.ConversationController.load();
  });
  afterEach(async () => {
    await emptyDir(
      getAttachmentsPath(window.SignalContext.config.userDataPath)
    );
  });
  it('eraseMessageContents only preserves explicitly preserved fields', async () => {
    const now = Date.now();
    const attributes: MessageAttributesType = {
      id: v7(),
      type: 'incoming',
      sent_at: now,
      received_at: now,
      conversationId: 'convoId',
      timestamp: now,
      schemaVersion: 12,
      body: 'body',
      poll: {
        question: 'poll question',
      } as PollMessageAttribute,
      sendStateByConversationId: { aci: { status: SendStatus.Delivered } },
      storyReplyContext: {
        attachment: { contentType: IMAGE_BMP, size: 128 },
        messageId: 'messageId',
      },
    };
    await window.MessageCache.saveMessage(attributes, { forceSave: true });
    const message = new MessageModel(attributes);

    await eraseMessageContents(message, 'unsupported-message');

    assert.deepEqual(message.attributes, {
      id: attributes.id,
      type: attributes.type,
      sent_at: attributes.sent_at,
      received_at: attributes.received_at,
      conversationId: 'convoId',
      timestamp: attributes.timestamp,
      schemaVersion: 12,
      sendStateByConversationId: { aci: { status: SendStatus.Delivered } },
      isErased: true,
    });
  });

  it('eraseMessageContents deletes any referenced attachments', async () => {
    await writeAttachmentFile('path-to-attachment');
    await writeAttachmentFile('a-random-attachment');

    assert.sameDeepMembers(listAttachmentFiles(), [
      'path-to-attachment',
      'a-random-attachment',
    ]);

    const now = Date.now();
    const attributes: MessageAttributesType = {
      id: v7(),
      type: 'incoming',
      sent_at: now,
      received_at: now,
      conversationId: 'convoId',
      timestamp: now,
      schemaVersion: 12,
      attachments: [
        {
          size: 128,
          contentType: IMAGE_JPEG,
          path: 'path-to-attachment',
        },
      ],
      sendStateByConversationId: { aci: { status: SendStatus.Delivered } },
    };
    await window.MessageCache.saveMessage(attributes, { forceSave: true });

    const message = new MessageModel(attributes);
    await eraseMessageContents(message, 'unsupported-message');

    assert.deepEqual(message.attributes, {
      id: attributes.id,
      type: attributes.type,
      sent_at: attributes.sent_at,
      received_at: attributes.received_at,
      conversationId: 'convoId',
      timestamp: attributes.timestamp,
      schemaVersion: 12,
      sendStateByConversationId: { aci: { status: SendStatus.Delivered } },
      isErased: true,
    });
    assert.sameDeepMembers(listAttachmentFiles(), ['a-random-attachment']);
  });

  describe('cleanupStoryReplies', () => {
    it('cleanupFilesAndReferencesToMessage deletes story replies in group conversations', async () => {
      const now = Date.now();
      const groupConversationId = v7();
      const storyAuthorAci = generateAci();

      window.ConversationController.getOrCreate(groupConversationId, 'group');

      const storyAttributes: MessageAttributesType = {
        id: v7(),
        type: 'story',
        sent_at: now,
        received_at: now,
        conversationId: groupConversationId,
        timestamp: now,
        sourceServiceId: storyAuthorAci,
      };
      await window.MessageCache.saveMessage(storyAttributes, {
        forceSave: true,
      });

      const reply1: MessageAttributesType = {
        id: v7(),
        type: 'incoming',
        sent_at: now - 20,
        received_at: now - 20,
        conversationId: groupConversationId,
        timestamp: now - 20,
        storyId: storyAttributes.id,
        storyReplyContext: {
          authorAci: storyAuthorAci,
          attachment: { contentType: IMAGE_BMP, size: 128 },
          messageId: storyAttributes.id,
        },
      };
      const reply2: MessageAttributesType = {
        id: v7(),
        type: 'incoming',
        sent_at: now - 10,
        received_at: now - 10,
        conversationId: groupConversationId,
        timestamp: now - 10,
        storyId: storyAttributes.id,
        storyReplyContext: {
          authorAci: storyAuthorAci,
          attachment: { contentType: IMAGE_BMP, size: 256 },
          messageId: storyAttributes.id,
        },
      };
      await window.MessageCache.saveMessage(reply1, { forceSave: true });
      await window.MessageCache.saveMessage(reply2, { forceSave: true });

      // Check they were saved
      assert.strictEqual(
        (await DataReader.getMessageById(reply1.id))?.timestamp,
        reply1.timestamp
      );
      assert.strictEqual(
        (await DataReader.getMessageById(reply2.id))?.timestamp,
        reply2.timestamp
      );

      await cleanupFilesAndReferencesToMessage(storyAttributes);

      assert.isUndefined(await DataReader.getMessageById(reply1.id));
      assert.isUndefined(await DataReader.getMessageById(reply2.id));
    });

    it('cleanupFilesAndReferencesToMessage clears storyReplyContext for 1:1 conversations', async () => {
      const now = Date.now();
      const directConversationId = v7();
      const storyAuthorAci = generateAci();

      window.ConversationController.getOrCreate(
        directConversationId,
        'private'
      );

      const storyAttributes: MessageAttributesType = {
        id: v7(),
        type: 'story',
        sent_at: now,
        received_at: now,
        conversationId: directConversationId,
        timestamp: now,
        sourceServiceId: storyAuthorAci,
      };
      await window.MessageCache.saveMessage(storyAttributes, {
        forceSave: true,
      });

      const reply1: MessageAttributesType = {
        id: v7(),
        type: 'incoming',
        sent_at: now - 20,
        received_at: now - 20,
        conversationId: directConversationId,
        timestamp: now - 20,
        storyId: storyAttributes.id,
        storyReplyContext: {
          authorAci: storyAuthorAci,
          attachment: { contentType: IMAGE_BMP, size: 128 },
          messageId: storyAttributes.id,
        },
      };
      const reply2: MessageAttributesType = {
        id: v7(),
        type: 'incoming',
        sent_at: now - 10,
        received_at: now - 10,
        conversationId: directConversationId,
        timestamp: now - 10,
        storyId: storyAttributes.id,
        storyReplyContext: {
          authorAci: storyAuthorAci,
          attachment: { contentType: IMAGE_BMP, size: 256 },
          messageId: storyAttributes.id,
        },
      };
      await window.MessageCache.saveMessage(reply1, { forceSave: true });
      await window.MessageCache.saveMessage(reply2, { forceSave: true });

      await cleanupFilesAndReferencesToMessage(storyAttributes);

      // Verify replies still exist in DB (not deleted for 1:1)
      const allAfter = await DataReader._getAllMessages();
      const repliesAfter = allAfter.filter(
        m => m.storyId === storyAttributes.id && m.type !== 'story'
      );
      assert.lengthOf(
        repliesAfter,
        2,
        '1:1 story replies should NOT be deleted'
      );

      // Verify storyReplyContext was cleared
      for (const reply of repliesAfter) {
        assert.isDefined(
          reply.storyReplyContext,
          'storyReplyContext should still exist'
        );
        assert.strictEqual(
          reply.storyReplyContext?.messageId,
          '',
          'messageId should be empty string'
        );
        assert.isUndefined(
          reply.storyReplyContext?.attachment,
          'attachment should be undefined'
        );
        assert.strictEqual(
          reply.storyReplyContext?.authorAci,
          storyAuthorAci,
          'authorAci should be preserved'
        );
      }
    });
  });
});
