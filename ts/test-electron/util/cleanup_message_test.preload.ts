// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v7 } from 'uuid';
import { assert } from 'chai';

import { eraseMessageContents } from '../../util/cleanup.preload.js';
import { MessageModel } from '../../models/messages.preload.js';
import type { PollMessageAttribute } from '../../types/Polls.dom.js';
import { DataWriter } from '../../sql/Client.preload.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';
import { generateAci } from '../../types/ServiceId.std.js';
import type { MessageAttributesType } from '../../model-types.js';
import { IMAGE_BMP } from '../../types/MIME.std.js';
import { SendStatus } from '../../messages/MessageSendState.std.js';

describe('eraseMessageContents', () => {
  beforeEach(async () => {
    await DataWriter.removeAll();
    await itemStorage.user.setAciAndDeviceId(generateAci(), 1);
    await window.ConversationController.load();
  });
  it('only preserves explicitly preserved fields', async () => {
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
});
