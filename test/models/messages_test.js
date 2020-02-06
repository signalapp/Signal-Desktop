/* global ConversationController, i18n, Whisper */

'use strict';

const attributes = {
  type: 'outgoing',
  body: 'hi',
  conversationId: 'foo',
  attachments: [],
  received_at: new Date().getTime(),
};

const source = '+14155555555';

describe('MessageCollection', () => {
  before(async () => {
    await clearDatabase();
    ConversationController.reset();
    await ConversationController.load();
  });
  after(() => {
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

    message = messages.add({ group_update: { left: 'Alice' } });
    assert.equal(
      message.getDescription(),
      'Alice left the group',
      'Notes one person leaving the group.'
    );

    message = messages.add({ group_update: { name: 'blerg' } });
    assert.equal(
      message.getDescription(),
      "Group name has been set to 'blerg'",
      'Returns a single notice if only group_updates.name changes.'
    );

    message = messages.add({ group_update: { joined: ['Bob'] } });
    assert.equal(
      message.getDescription(),
      'Bob joined the group',
      'Returns a single notice if only group_updates.joined changes.'
    );

    message = messages.add({
      group_update: { joined: ['Bob', 'Alice', 'Eve'] },
    });
    assert.equal(
      message.getDescription(),
      'Bob, Alice, Eve joined the group',
      'Notes when >1 person joins the group.'
    );

    message = messages.add({
      group_update: { joined: ['Bob'], name: 'blerg' },
    });
    assert.equal(
      message.getDescription(),
      "Group name has been set to 'blerg', Bob joined the group",
      'Notes when there are multiple changes to group_updates properties.'
    );

    message = messages.add({ flags: true });
    assert.equal(message.getDescription(), i18n('sessionEnded'));
  });

  it('checks if it is end of the session', () => {
    const messages = new Whisper.MessageCollection();
    let message = messages.add(attributes);
    assert.notOk(message.isEndSession());

    message = messages.add({ flags: true });
    assert.ok(message.isEndSession());
  });
});
