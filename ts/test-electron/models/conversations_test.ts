// Copyright 2014 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v7 as generateUuid } from 'uuid';

import { DataWriter } from '../../sql/Client';
import { SendStatus } from '../../messages/MessageSendState';
import { IMAGE_PNG } from '../../types/MIME';
import { generateAci, generatePni } from '../../types/ServiceId';
import { MessageModel } from '../../models/messages';

describe('Conversations', () => {
  async function resetConversationController(): Promise<void> {
    window.ConversationController.reset();
    await window.ConversationController.load();
  }

  beforeEach(resetConversationController);

  afterEach(resetConversationController);

  it('updates lastMessage even in race conditions with db', async () => {
    const ourNumber = '+15550000000';
    const ourAci = generateAci();
    const ourPni = generatePni();

    // Creating a fake conversation
    const conversation = new window.Whisper.Conversation({
      avatars: [],
      id: generateUuid(),
      e164: '+15551234567',
      serviceId: generateAci(),
      type: 'private',
      inbox_position: 0,
      isPinned: false,
      markedUnread: false,
      lastMessageDeletedForEveryone: false,
      messageCount: 0,
      sentMessageCount: 0,
      profileSharing: true,
      version: 0,
      expireTimerVersion: 1,
      lastMessage: 'starting value',
    });

    await window.textsecure.storage.user.setCredentials({
      number: ourNumber,
      aci: ourAci,
      pni: ourPni,
      deviceId: 2,
      deviceName: 'my device',
      password: 'password',
    });
    await window.ConversationController.load();
    await window.ConversationController.getOrCreateAndWait(
      conversation.attributes.e164 ?? null,
      conversation.attributes.type,
      conversation.attributes
    );

    // Creating a fake message
    const now = Date.now();
    let message = new MessageModel({
      attachments: [],
      body: 'bananas',
      conversationId: conversation.id,
      expirationStartTimestamp: now,
      hasAttachments: false,
      hasFileAttachments: false,
      hasVisualMediaAttachments: false,
      id: generateUuid(),
      received_at: now,
      sent_at: now,
      timestamp: now,
      type: 'outgoing',
      sendStateByConversationId: {
        [conversation.id]: {
          status: SendStatus.Sent,
          updatedAt: now,
        },
      },
    });

    // Saving to db and updating the convo's last message
    await window.MessageCache.saveMessage(message.attributes, {
      forceSave: true,
    });
    message = window.MessageCache.register(message);
    await DataWriter.updateConversation(conversation.attributes);
    await conversation.updateLastMessage();

    // Should be set to bananas because that's the last message sent.
    assert.strictEqual(conversation.get('lastMessage'), 'bananas');

    // Erasing message contents (DOE)
    message.set({
      isErased: true,
      body: '',
      bodyRanges: undefined,
      attachments: [],
      quote: undefined,
      contact: [],
      sticker: undefined,
      preview: [],
    });

    // Not saving the message to db on purpose
    // to simulate that a save hasn't taken place yet.

    // Updating convo's last message, should pick it up from memory
    await conversation.updateLastMessage();

    assert.strictEqual(conversation.get('lastMessage'), '');
  });

  it('only produces attachments on a quote with an image', async () => {
    // Creating a fake conversation
    const conversation = new window.Whisper.Conversation({
      avatars: [],
      id: generateUuid(),
      e164: '+15551234567',
      serviceId: generateAci(),
      type: 'private',
      inbox_position: 0,
      isPinned: false,
      markedUnread: false,
      lastMessageDeletedForEveryone: false,
      messageCount: 0,
      sentMessageCount: 0,
      profileSharing: true,
      version: 0,
      expireTimerVersion: 1,
    });

    const resultNoImage = await conversation.getQuoteAttachment(
      [],
      [
        {
          url: 'https://sometest.signal.org/',
          isCallLink: false,
        },
      ]
    );

    assert.deepEqual(resultNoImage, []);

    const [resultWithImage] = await conversation.getQuoteAttachment(
      [],
      [
        {
          url: 'https://sometest.signal.org/',
          image: {
            contentType: IMAGE_PNG,
            size: 100,
            data: new Uint8Array(),
          },
          isCallLink: false,
        },
      ]
    );

    assert.equal(resultWithImage.contentType, 'image/png');
    assert.equal(resultWithImage.fileName, null);
  });
});
