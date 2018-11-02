/* global storage, textsecure, Whisper */

'use strict';

describe('ConversationCollection', () => {
  textsecure.messaging = new textsecure.MessageSender('');

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
  const attributes = { type: 'private', id: '+18085555555' };
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
    const convo = new Whisper.Conversation({ id: '+18085555555' });
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
      id: '+18085555555',
    });
    await convo.fetchMessages();
    assert.notEqual(convo.messageCollection.length, 0);
  });

  it('contains only its own messages', async () => {
    const convo = new Whisper.ConversationCollection().add({
      id: '+18085556666',
    });
    await convo.fetchMessages();
    assert.strictEqual(convo.messageCollection.length, 0);
  });

  it('adds conversation to message collection upon leaving group', async () => {
    const convo = new Whisper.ConversationCollection().add({
      type: 'group',
      id: 'a random string',
    });
    await convo.leaveGroup();
    assert.notEqual(convo.messageCollection.length, 0);
  });

  it('has a title', () => {
    const convos = new Whisper.ConversationCollection();
    let convo = convos.add(attributes);
    assert.equal(convo.getTitle(), '+1 808-555-5555');

    convo = convos.add({ type: '' });
    assert.equal(convo.getTitle(), 'Unknown group');

    convo = convos.add({ name: 'name' });
    assert.equal(convo.getTitle(), 'name');
  });

  it('returns the number', () => {
    const convos = new Whisper.ConversationCollection();
    let convo = convos.add(attributes);
    assert.equal(convo.getNumber(), '+1 808-555-5555');

    convo = convos.add({ type: '' });
    assert.equal(convo.getNumber(), '');
  });

  it('has an avatar', () => {
    const convo = new Whisper.ConversationCollection().add(attributes);
    const avatar = convo.getAvatar();
    assert.property(avatar, 'content');
    assert.property(avatar, 'color');
  });

  describe('phone number parsing', () => {
    after(() => {
      storage.remove('regionCode');
    });
    function checkAttributes(number) {
      const convo = new Whisper.ConversationCollection().add({
        type: 'private',
      });
      convo.set('id', number);
      convo.validate(convo.attributes);
      assert.strictEqual(convo.get('id'), '+14155555555', number);
    }
    it('processes the phone number when validating', () => {
      ['+14155555555'].forEach(checkAttributes);
    });
    it('defaults to the local regionCode', () => {
      storage.put('regionCode', 'US');
      ['14155555555', '4155555555'].forEach(checkAttributes);
    });
    it('works with common phone number formats', () => {
      storage.put('regionCode', 'US');
      [
        '415 555 5555',
        '415-555-5555',
        '(415) 555 5555',
        '(415) 555-5555',
        '1 415 555 5555',
        '1 415-555-5555',
        '1 (415) 555 5555',
        '1 (415) 555-5555',
        '+1 415 555 5555',
        '+1 415-555-5555',
        '+1 (415) 555 5555',
        '+1 (415) 555-5555',
      ].forEach(checkAttributes);
    });
  });
});

describe('Conversation search', () => {
  let convo;

  beforeEach(async () => {
    convo = new Whisper.ConversationCollection().add({
      id: '+14155555555',
      type: 'private',
      name: 'John Doe',
    });
    await window.Signal.Data.saveConversation(convo.attributes, {
      Conversation: Whisper.Conversation,
    });
  });

  afterEach(clearDatabase);

  async function testSearch(queries) {
    await Promise.all(
      queries.map(async query => {
        const collection = new Whisper.ConversationCollection();
        await collection.search(query);

        assert.isDefined(collection.get(convo.id), `no result for "${query}"`);
      })
    );
  }
  it('matches by partial phone number', () => {
    return testSearch([
      '1',
      '4',
      '+1',
      '415',
      '4155',
      '4155555555',
      '14155555555',
      '+14155555555',
    ]);
  });
  it('matches by name', () => {
    return testSearch(['John', 'Doe', 'john', 'doe', 'John Doe', 'john doe']);
  });
  it('does not match +', async () => {
    const collection = new Whisper.ConversationCollection();
    await collection.search('+');
    assert.isUndefined(collection.get(convo.id), 'got result for "+"');
  });
});
