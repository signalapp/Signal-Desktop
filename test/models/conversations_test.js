/* global textsecure, Whisper */

'use strict';

describe('ConversationCollection', () => {
  textsecure.messaging = new textsecure.MessageSender();

  before(clearDatabase);
  after(clearDatabase);

  it('should be ordered newest to oldest', () => {
    const conversations = new Whisper.ConversationCollection();
    // Timestamps
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    // Add convos
    conversations.add({ timestamp: today });
    conversations.add({ timestamp: tomorrow });

    const { models } = conversations;
    const firstTimestamp = models[0].get('timestamp').getTime();
    const secondTimestamp = models[1].get('timestamp').getTime();

    // Compare timestamps
    assert(firstTimestamp > secondTimestamp);
  });
});

describe('Conversation', () => {
  const attributes = {
    type: 'private',
    id: '051d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94ab',
  };
  before(async () => {
    const convo = new Whisper.ConversationCollection().add(attributes);
    await window.Signal.Data.saveConversation(convo.attributes, {
      Conversation: Whisper.Conversation,
    });

    const message = convo.messageCollection.add({
      body: 'hello world',
      conversationId: convo.id,
      type: 'outgoing',
      sent_at: Date.now(),
      received_at: Date.now(),
    });
    await window.Signal.Data.saveMessage(message.attributes, {
      Message: Whisper.Message,
    });
  });
  after(clearDatabase);

  it('sorts its contacts in an intl-friendly way', () => {
    const convo = new Whisper.Conversation({
      id: '051d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94ab',
    });
    convo.contactCollection.add(
      new Whisper.Conversation({
        name: 'C',
      })
    );
    convo.contactCollection.add(
      new Whisper.Conversation({
        name: 'B',
      })
    );
    convo.contactCollection.add(
      new Whisper.Conversation({
        name: 'Á',
      })
    );

    assert.strictEqual(convo.contactCollection.at('0').get('name'), 'Á');
    assert.strictEqual(convo.contactCollection.at('1').get('name'), 'B');
    assert.strictEqual(convo.contactCollection.at('2').get('name'), 'C');
  });

  it('contains its own messages', async () => {
    const convo = new Whisper.ConversationCollection().add({
      id: '051d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94ab',
    });
    await convo.fetchMessages();
    assert.notEqual(convo.messageCollection.length, 0);
  });

  it('contains only its own messages', async () => {
    const convo = new Whisper.ConversationCollection().add({
      id: '052d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94ab',
    });
    await convo.fetchMessages();
    assert.strictEqual(convo.messageCollection.length, 0);
  });

  it('adds conversation to message collection upon leaving group', async () => {
    const convo = new Whisper.ConversationCollection().add({
      type: 'group',
      id: '052d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94ab',
    });
    await convo.leaveGroup();
    assert.notEqual(convo.messageCollection.length, 0);
  });

  it('has a title', () => {
    const convos = new Whisper.ConversationCollection();
    let convo = convos.add(attributes);
    assert.equal(
      convo.getTitle(),
      '051d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94ab'
    );

    convo = convos.add({ type: '' });
    assert.equal(convo.getTitle(), 'Unknown group');

    convo = convos.add({ name: 'name' });
    assert.equal(convo.getTitle(), 'name');
  });

  it('returns the number', () => {
    const convos = new Whisper.ConversationCollection();
    let convo = convos.add(attributes);
    assert.equal(
      convo.getNumber(),
      '051d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94ab'
    );

    convo = convos.add({ type: '' });
    assert.equal(convo.getNumber(), '');
  });

  describe('when set to private', () => {
    it('correctly validates hex numbers', () => {
      const regularId = new Whisper.Conversation({
        type: 'private',
        id:
          '051d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94ab',
      });
      const invalidId = new Whisper.Conversation({
        type: 'private',
        id:
          'j71d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94ab',
      });
      assert.ok(regularId.isValid());
      assert.notOk(invalidId.isValid());
    });

    it('correctly validates length', () => {
      const regularId33 = new Whisper.Conversation({
        type: 'private',
        id:
          '051d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94ab',
      });
      const regularId32 = new Whisper.Conversation({
        type: 'private',
        id: '1d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94ab',
      });
      const shortId = new Whisper.Conversation({
        type: 'private',
        id: '771d11d',
      });
      const longId = new Whisper.Conversation({
        type: 'private',
        id:
          '771d11d01e56d9bfc3d74115c33225a632321b509ac17a13fdeac71165d09b94abaa',
      });
      assert.ok(regularId33.isValid());
      assert.ok(regularId32.isValid());
      assert.notOk(shortId.isValid());
      assert.notOk(longId.isValid());
    });
  });
});
