var Whisper = Whisper || {};

(function () {
  'use strict';

  var Message  = Backbone.Model.extend({
    validate: function(attributes, options) {
      var required = ['body', 'timestamp', 'threadId'];
      var missing = _.filter(required, function(attr) { return !attributes[attr]; });
      if (missing.length) { console.log("Message missing attributes: " + missing); }
    },

    thread: function() {
      return Whisper.Threads.get(this.get('threadId'));
    }
  });

  Whisper.MessageCollection = Backbone.Collection.extend({
    model: Message,
    comparator: 'timestamp',
    initialize: function(models, options) {
      this.localStorage = new Backbone.LocalStorage("Messages-" + options.threadId);
    }
  });

  Whisper.Messages = new (Backbone.Collection.extend({
    localStorage: new Backbone.LocalStorage("Messages"),
    model: Message,
    comparator: 'timestamp',

    addIncomingMessage: function(decrypted) {
      //TODO: The data in decrypted (from subscribeToPush) should already be cleaned up
      var attachments = [];
      for (var i = 0; i < decrypted.message.attachments.length; i++)
        attachments[i] = "data:" + decrypted.message.attachments[i].contentType + ";base64," + btoa(getString(decrypted.message.attachments[i].decrypted));

      var thread = Whisper.Threads.findOrCreateForIncomingMessage(decrypted);
      var m = thread.messages().add({
        person: decrypted.pushMessage.source,
        threadId: thread.id,
        body: decrypted.message.body,
        attachments: attachments,
        type: 'incoming',
        timestamp: decrypted.pushMessage.timestamp
      });
      m.save();

      if (decrypted.message.timestamp > thread.get('timestamp')) {
        thread.set('timestamp', decrypted.message.timestamp);
      }
      thread.save({unreadCount: thread.get('unreadCount') + 1, active: true});
      return m;
    }

  }))();
})()
