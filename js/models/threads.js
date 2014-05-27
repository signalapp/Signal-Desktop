var Whisper = Whisper || {};

(function () {
  'use strict';

  var Thread = Backbone.Model.extend({
    defaults: function() {
      return {
        image: '/images/default.png',
        unreadCount: 0,
        timestamp: new Date().getTime()
      };
    },

    validate: function(attributes, options) {
      var required = ['id', 'type', 'recipients', 'timestamp', 'image', 'name'];
      var missing = _.filter(required, function(attr) { return !attributes[attr]; });
      if (missing.length) { return "Thread must have " + missing; }
      if (attributes.recipients.length === 0) {
        return "No recipients for thread " + this.id;
      }
      for (var person in attributes.recipients) {
        if (!person) return "Invalid recipient";
      }
    },

    sendMessage: function(message) {
      return new Promise(function(resolve) {
        var m = Whisper.Messages.addOutgoingMessage(message, this);
        textsecure.sendMessage(this.get('recipients'), m.toProto(),
          function(result) {
            console.log(result);
            resolve();
          }
        );
      }.bind(this));
    },

    messages: function() {
      return Whisper.Messages.where({threadId: this.id});
    },
  });

  Whisper.Threads = new (Backbone.Collection.extend({
    localStorage: new Backbone.LocalStorage("Threads"),
    model: Thread,
    comparator: 'timestamp',
    findOrCreate: function(attributes) {
      var thread = Whisper.Threads.add(attributes, {merge: true});
      thread.save();
      return thread;
    },

    findOrCreateForRecipients: function(recipients) {
      var attributes = {};
      if (recipients.length > 1) {
        attributes = {
          //TODO group id formatting?
          name       : recipients,
          recipients : recipients,
          type       : 'group',
        };
      } else {
        attributes = {
          id         : recipients[0],
          name       : recipients[0],
          recipients : recipients,
          type       : 'private',
        };
      }
      return this.findOrCreate(attributes);
    },

    findOrCreateForIncomingMessage: function(decrypted) {
      var attributes = {};
      if (decrypted.message.group) {
        attributes = {
          id         : decrypted.message.group.id,
          name       : decrypted.message.group.name,
          recipients : decrypted.message.group.members,
          type       : 'group',
        };
      } else {
        attributes = {
          id         : decrypted.pushMessage.source,
          name       : decrypted.pushMessage.source,
          recipients : [decrypted.pushMessage.source],
          type       : 'private'
        };
      }
      return this.findOrCreate(attributes);
    }
  }))();
})();
