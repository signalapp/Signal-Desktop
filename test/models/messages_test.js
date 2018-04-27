/*
 * vim: ts=4:sw=4:expandtab
 */
(function() {
  'use strict';

  function deleteAllMessages() {
    return new Promise(function(resolve, reject) {
      var messages = new Whisper.MessageCollection();
      return messages.fetch().then(function() {
        messages.destroyAll();
        resolve();
      }, reject);
    });
  }

  var attributes = {
    type: 'outgoing',
    body: 'hi',
    conversationId: 'foo',
    attachments: [],
    received_at: new Date().getTime(),
  };

  var attachment = {
    data: 'datasaurus',
    contentType: 'plain/text',
  };

  var source = '+14155555555';

  describe('MessageCollection', function() {
    before(function() {
      return Promise.all([deleteAllMessages(), ConversationController.load()]);
    });
    after(function() {
      return deleteAllMessages();
    });

    it('has no image url', function() {
      var messages = new Whisper.MessageCollection();
      var message = messages.add(attributes);
      assert.isNull(message.getImageUrl());
    });

    it('updates image url', function() {
      var messages = new Whisper.MessageCollection();
      var message = messages.add({ attachments: [attachment] });

      var firstUrl = message.getImageUrl();
      message.updateImageUrl();
      var secondUrl = message.getImageUrl();
      assert.notEqual(secondUrl, firstUrl);
    });

    it('gets outgoing contact', function() {
      var messages = new Whisper.MessageCollection();
      var message = messages.add(attributes);
      message.getContact();
    });

    it('gets incoming contact', function() {
      var messages = new Whisper.MessageCollection();
      var message = messages.add({
        type: 'incoming',
        source: source,
      });
      message.getContact();
    });

    it('adds without saving', function() {
      var messages = new Whisper.MessageCollection();
      var message = messages.add(attributes);
      assert.notEqual(messages.length, 0);

      var messages = new Whisper.MessageCollection();
      assert.strictEqual(messages.length, 0);
    });

    it('saves asynchronously', function(done) {
      new Whisper.MessageCollection()
        .add(attributes)
        .save()
        .then(done);
    });

    it('fetches persistent messages', function(done) {
      var messages = new Whisper.MessageCollection();
      assert.strictEqual(messages.length, 0);
      messages.fetch().then(function() {
        assert.notEqual(messages.length, 0);
        var m = messages.at(0).attributes;
        _.each(attributes, function(val, key) {
          assert.deepEqual(m[key], val);
        });
        done();
      });
    });

    it('destroys persistent messages', function(done) {
      var messages = new Whisper.MessageCollection();
      messages.fetch().then(function() {
        messages.destroyAll().then(function() {
          var messages = new Whisper.MessageCollection();
          messages.fetch().then(function() {
            assert.strictEqual(messages.length, 0);
            done();
          });
        });
      });
    });

    it('should be ordered oldest to newest', function() {
      var messages = new Whisper.MessageCollection();
      // Timestamps
      var today = new Date();
      var tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);

      // Add threads
      messages.add({ received_at: today });
      messages.add({ received_at: tomorrow });

      var models = messages.models;
      var firstTimestamp = models[0].get('received_at').getTime();
      var secondTimestamp = models[1].get('received_at').getTime();

      // Compare timestamps
      assert(firstTimestamp < secondTimestamp);
    });

    it('checks if is incoming message', function() {
      var messages = new Whisper.MessageCollection();
      var message = messages.add(attributes);
      assert.notOk(message.isIncoming());
      message = messages.add({ type: 'incoming' });
      assert.ok(message.isIncoming());
    });

    it('checks if is outgoing message', function() {
      var messages = new Whisper.MessageCollection();
      var message = messages.add(attributes);
      assert.ok(message.isOutgoing());
      message = messages.add({ type: 'incoming' });
      assert.notOk(message.isOutgoing());
    });

    it('checks if is group update', function() {
      var messages = new Whisper.MessageCollection();
      var message = messages.add(attributes);
      assert.notOk(message.isGroupUpdate());

      message = messages.add({ group_update: true });
      assert.ok(message.isGroupUpdate());
    });

    it('returns an accurate description', function() {
      var messages = new Whisper.MessageCollection();
      var message = messages.add(attributes);

      assert.equal(
        message.getDescription(),
        'hi',
        'If no group updates or end session flags, return message body.'
      );

      message = messages.add({ group_update: { left: 'Alice' } });
      assert.equal(
        message.getDescription(),
        'Alice left the group.',
        'Notes one person leaving the group.'
      );

      message = messages.add({ group_update: { name: 'blerg' } });
      assert.equal(
        message.getDescription(),
        "Updated the group. Title is now 'blerg'.",
        'Returns a single notice if only group_updates.name changes.'
      );

      message = messages.add({ group_update: { joined: ['Bob'] } });
      assert.equal(
        message.getDescription(),
        'Updated the group. Bob joined the group.',
        'Returns a single notice if only group_updates.joined changes.'
      );

      message = messages.add({
        group_update: { joined: ['Bob', 'Alice', 'Eve'] },
      });
      assert.equal(
        message.getDescription(),
        'Updated the group. Bob, Alice, Eve joined the group.',
        'Notes when >1 person joins the group.'
      );

      message = messages.add({
        group_update: { joined: ['Bob'], name: 'blerg' },
      });
      assert.equal(
        message.getDescription(),
        "Updated the group. Title is now 'blerg'. Bob joined the group.",
        'Notes when there are multiple changes to group_updates properties.'
      );

      message = messages.add({ flags: true });
      assert.equal(message.getDescription(), i18n('sessionEnded'));
    });

    it('checks if it is end of the session', function() {
      var messages = new Whisper.MessageCollection();
      var message = messages.add(attributes);
      assert.notOk(message.isEndSession());

      message = messages.add({ flags: true });
      assert.ok(message.isEndSession());
    });
  });
})();
