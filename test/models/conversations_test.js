// Copyright 2014-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

describe('Conversations', () => {
  it('updates lastMessage even in race conditions with db', async () => {
    // Creating a fake conversation
    const conversation = new window.Whisper.Conversation({
      id: '8c45efca-67a4-4026-b990-9537d5d1a08f',
      e164: '+15551234567',
      uuid: '2f2734aa-f69d-4c1c-98eb-50eb0fc512d7',
      type: 'private',
    });

    const destinationE164 = '+15557654321';

    // Creating a fake message
    const now = Date.now();
    let message = new window.Whisper.Message({
      attachments: [],
      body: 'bananas',
      conversationId: conversation.id,
      delivered: 1,
      delivered_to: [destinationE164],
      destination: destinationE164,
      expirationStartTimestamp: now,
      hasAttachments: 0,
      hasFileAttachments: 0,
      hasVisualMediaAttachments: 0,
      id: 'd8f2b435-e2ef-46e0-8481-07e68af251c6',
      received_at: now,
      recipients: [destinationE164],
      sent: true,
      sent_at: now,
      sent_to: [destinationE164],
      timestamp: now,
      type: 'outgoing',
    });

    // Saving to db and updating the convo's last message
    await window.Signal.Data.saveMessage(message.attributes, {
      forceSave: true,
      Message: window.Whisper.Message,
    });
    message = window.MessageController.register(message.id, message);
    await window.Signal.Data.saveConversation(conversation.attributes, {
      Conversation: window.Whisper.Conversation,
    });
    await conversation.updateLastMessage();

    // Should be set to bananas because that's the last message sent.
    assert.strictEqual(conversation.get('lastMessage'), 'bananas');

    // Erasing message contents (DOE)
    message.set({
      isErased: true,
      body: '',
      bodyRanges: undefined,
      attachments: [],
      quote: null,
      contact: [],
      sticker: null,
      preview: [],
    });

    // Not saving the message to db on purpose
    // to simulate that a save hasn't taken place yet.

    // Updating convo's last message, should pick it up from memory
    await conversation.updateLastMessage();

    assert.strictEqual(conversation.get('lastMessage'), '');
  });
});
