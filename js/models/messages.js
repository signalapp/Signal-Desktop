var Whisper = Whisper || {};

(function () {
  'use strict';

  var Message  = Backbone.Model.extend({
    validate: function(attributes, options) {
      var required = ['timestamp', 'threadId'];
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
      return Promise.all(decrypted.message.attachments.map(function(a) {
        return new Promise(function(resolve, reject) {
          var dataView = new DataView(a.decrypted);
          var blob = new Blob([dataView], { type: a.contentType });
          var FR = new FileReader();
          FR.onload = function(e) {
            resolve(e.target.result);
          };
          FR.onerror = reject;
          FR.readAsDataURL(blob);
        });
      })).then(function(base64_attachments) {
        var thread = Whisper.Threads.findOrCreateForIncomingMessage(decrypted);
        var timestamp = decrypted.pushMessage.timestamp.toNumber();
        var m = thread.messages().add({
          person: decrypted.pushMessage.source,
          threadId: thread.id,
          body: decrypted.message.body,
          attachments: base64_attachments,
          type: 'incoming',
          timestamp: timestamp
        });
        m.save();

        if (timestamp > thread.get('timestamp')) {
          thread.set('timestamp', timestamp);
        }
        thread.save({unreadCount: thread.get('unreadCount') + 1, active: true});
        return m;
      });
    }

  }))();
})()
