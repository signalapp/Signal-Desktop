// vim: ts=2:sw=2:expandtab:
var Whisper = Whisper || {};

(function () {
  'use strict';

  var Thread = Backbone.Model.extend({
    defaults: function() {
      return {
        image: '/images/default.png',
        unreadCount: 0,
        timestamp: new Date().getTime(),
        active: true
      };
    },

    validate: function(attributes, options) {
      var required = ['type', 'timestamp', 'image', 'name'];
      var missing = _.filter(required, function(attr) { return !attributes[attr]; });
      if (missing.length) { return "Thread must have " + missing; }
    },

    sendMessage: function(message) {
      var timestamp = Date.now();

      this.messages().add({ type: 'outgoing',
                            body: message,
                            threadId: this.id,
                            timestamp: timestamp }).save();

      this.save({ timestamp:   timestamp,
                  unreadCount: 0,
                  active:      true});

      if (this.get('type') == 'private') {
        var promise = textsecure.messaging.sendMessageToNumber(this.get('id'), message, []);
      }
      else {
        var promise = textsecure.messaging.sendMessageToGroup(this.get('id'), message, []);
      }
      promise.then(
        function(result) {
          console.log(result);
        }
      ).catch(
        function(error) {
          console.log(error);
        }
      );
    },

    messages: function() {
      if (!this.messageCollection) {
        this.messageCollection = new Whisper.MessageCollection([], {threadId: this.id});
      }
      return this.messageCollection;
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

    createGroup: function(recipients, name) {
      var group = textsecure.storage.groups.createNewGroup(recipients);
      var attributes = {};
      attributes = {
        id        : group.id,
        name      : name,
        numbers   : group.numbers,
        type      : 'group',
      };
      return this.findOrCreate(attributes);
    },

    findOrCreateForRecipient: function(recipient) {
      var attributes = {};
      attributes = {
        id        : recipient,
        name      : recipient,
        type      : 'private',
      };
      return this.findOrCreate(attributes);
    },

    findOrCreateForIncomingMessage: function(decrypted) {
      var attributes = {};
      if (decrypted.message.group) {
        attributes = {
          id         : decrypted.message.group.id,
          name       : decrypted.message.group.name,
          type       : 'group',
        };
      } else {
        attributes = {
          id         : decrypted.pushMessage.source,
          name       : decrypted.pushMessage.source,
          type       : 'private'
        };
      }
      return this.findOrCreate(attributes);
    }
  }))();
})();
