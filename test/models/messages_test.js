/* global ConversationController, i18n, Whisper, textsecure */

'use strict';

const attributes = {
  type: 'outgoing',
  body: 'hi',
  conversationId: 'foo',
  attachments: [],
  received_at: new Date().getTime(),
};

const source = '+1 415-555-5555';
const me = '+14155555556';
const ourUuid = window.getGuid();

describe('MessageCollection', () => {
  before(async () => {
    await clearDatabase();
    ConversationController.reset();
    await ConversationController.load();
    textsecure.storage.put('number_id', `${me}.2`);
    textsecure.storage.put('uuid_id', `${ourUuid}.2`);
  });
  after(() => {
    textsecure.storage.put('number_id', null);
    textsecure.storage.put('uuid_id', null);
    return clearDatabase();
  });

  it('gets outgoing contact', () => {
    const messages = new Whisper.MessageCollection();
    const message = messages.add(attributes);
    message.getContact();
  });

  it('gets incoming contact', () => {
    const messages = new Whisper.MessageCollection();
    const message = messages.add({
      type: 'incoming',
      source,
    });
    message.getContact();
  });

  it('should be ordered oldest to newest', () => {
    const messages = new Whisper.MessageCollection();
    // Timestamps
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    // Add threads
    messages.add({ received_at: today });
    messages.add({ received_at: tomorrow });

    const { models } = messages;
    const firstTimestamp = models[0].get('received_at').getTime();
    const secondTimestamp = models[1].get('received_at').getTime();

    // Compare timestamps
    assert(firstTimestamp < secondTimestamp);
  });

  it('checks if is incoming message', () => {
    const messages = new Whisper.MessageCollection();
    let message = messages.add(attributes);
    assert.notOk(message.isIncoming());
    message = messages.add({ type: 'incoming' });
    assert.ok(message.isIncoming());
  });

  it('checks if is outgoing message', () => {
    const messages = new Whisper.MessageCollection();
    let message = messages.add(attributes);
    assert.ok(message.isOutgoing());
    message = messages.add({ type: 'incoming' });
    assert.notOk(message.isOutgoing());
  });

  it('checks if is group update', () => {
    const messages = new Whisper.MessageCollection();
    let message = messages.add(attributes);
    assert.notOk(message.isGroupUpdate());

    message = messages.add({ group_update: true });
    assert.ok(message.isGroupUpdate());
  });

  it('returns an accurate description', () => {
    const messages = new Whisper.MessageCollection();
    let message = messages.add(attributes);

    assert.equal(
      message.getDescription(),
      'hi',
      'If no group updates or end session flags, return message body.'
    );

    message = messages.add({
      group_update: {},
      source: 'Alice',
      type: 'incoming',
    });
    assert.equal(
      message.getDescription(),
      'Alice updated the group.',
      'Empty group updates - generic message.'
    );

    message = messages.add({
      type: 'incoming',
      source,
      group_update: { left: 'Alice' },
    });
    assert.equal(
      message.getDescription(),
      'Alice left the group.',
      'Notes one person leaving the group.'
    );

    message = messages.add({
      type: 'incoming',
      source: me,
      group_update: { left: 'You' },
    });
    assert.equal(
      message.getDescription(),
      'You left the group.',
      'Notes that you left the group.'
    );

    message = messages.add({
      type: 'incoming',
      source,
      group_update: { name: 'blerg' },
    });
    assert.equal(
      message.getDescription(),
      "+1 415-555-5555 updated the group. Group name is now 'blerg'.",
      'Returns sender and name change.'
    );

    message = messages.add({
      type: 'incoming',
      source: me,
      group_update: { name: 'blerg' },
    });
    assert.equal(
      message.getDescription(),
      "You updated the group. Group name is now 'blerg'.",
      'Includes "you" as sender along with group name change.'
    );

    message = messages.add({
      type: 'incoming',
      source,
      group_update: { avatarUpdated: true },
    });
    assert.equal(
      message.getDescription(),
      '+1 415-555-5555 updated the group. Group avatar was updated.',
      'Includes sender and avatar update.'
    );

    message = messages.add({
      type: 'incoming',
      source,
      group_update: { joined: [me] },
    });
    assert.equal(
      message.getDescription(),
      '+1 415-555-5555 updated the group. You joined the group.',
      'Includes both sender and person added with join.'
    );

    message = messages.add({
      type: 'incoming',
      source,
      group_update: { joined: ['Bob'] },
    });
    assert.equal(
      message.getDescription(),
      '+1 415-555-5555 updated the group. Bob joined the group.',
      'Returns a single notice if only group_updates.joined changes.'
    );

    message = messages.add({
      type: 'incoming',
      source,
      group_update: { joined: ['Bob', 'Alice', 'Eve'] },
    });
    assert.equal(
      message.getDescription(),
      '+1 415-555-5555 updated the group. Bob, Alice, Eve joined the group.',
      'Notes when >1 person joins the group.'
    );

    message = messages.add({
      type: 'incoming',
      source,
      group_update: { joined: ['Bob', me, 'Alice', 'Eve'] },
    });
    assert.equal(
      message.getDescription(),
      '+1 415-555-5555 updated the group. Bob, Alice, Eve joined the group. You joined the group.',
      'Splits "You" out when multiple people are added along with you.'
    );

    message = messages.add({
      type: 'incoming',
      source,
      group_update: { joined: ['Bob'], name: 'blerg' },
    });
    assert.equal(
      message.getDescription(),
      "+1 415-555-5555 updated the group. Bob joined the group. Group name is now 'blerg'.",
      'Notes when there are multiple changes to group_updates properties.'
    );

    message = messages.add({ type: 'incoming', source, flags: true });
    assert.equal(message.getDescription(), i18n('sessionEnded'));
  });

  it('checks if it is end of the session', () => {
    const messages = new Whisper.MessageCollection();
    let message = messages.add(attributes);
    assert.notOk(message.isEndSession());

    message = messages.add({ type: 'incoming', source, flags: true });
    assert.ok(message.isEndSession());
  });
});
