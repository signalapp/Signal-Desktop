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
      var required = ['id', 'type', 'timestamp', 'image', 'name'];
      var missing = _.filter(required, function(attr) { return !attributes[attr]; });
      if (missing.length) { return "Thread must have " + missing; }
    },

    sendMessage: function(message) {
      var m = Whisper.Messages.addOutgoingMessage(message, this);
      if (this.get('type') == 'private')
        var promise = textsecure.messaging.sendMessageToNumber(this.get('id'), message, []);
      else
        var promise = textsecure.messaging.sendMessageToGroup(this.get('id'), message, []);
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
