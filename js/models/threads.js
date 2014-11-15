// vim: ts=2:sw=2:expandtab:

(function () {
  'use strict';

   window.Whisper = window.Whisper || {};

   function encodeAttachments (attachments) {
     return Promise.all(attachments.map(function(a) {
       return new Promise(function(resolve, reject) {
         var dataView = new DataView(a.data);
         var blob = new Blob([dataView], { type: a.contentType });
         var FR = new FileReader();
         FR.onload = function(e) {
           resolve(e.target.result);
         };
         FR.onerror = reject;
         FR.readAsDataURL(blob);
       });
     }));
   };

  var Thread = Backbone.Model.extend({
    defaults: function() {
      return {
        name: 'New Conversation',
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

    sendMessage: function(message, attachments) {
      return encodeAttachments(attachments).then(function(base64_attachments) {
        var timestamp = Date.now();
        this.messages().add({ type: 'outgoing',
                              body: message,
                              threadId: this.id,
                              attachments: base64_attachments,
                              timestamp: timestamp }).save();

        this.save({ timestamp:   timestamp,
                    unreadCount: 0,
                    active:      true});

        if (this.get('type') == 'private') {
          return textsecure.messaging.sendMessageToNumber(this.get('id'), message, attachments);
        }
        else {
          return textsecure.messaging.sendMessageToGroup(this.get('groupId'), message, attachments);
        }
      }.bind(this)).then(function(result) {
        console.log(result);
      }).catch(function(error) {
        console.log(error);
      });
    },

    receiveMessage: function(decrypted) {
      var thread = this;
      encodeAttachments(decrypted.message.attachments).then(function(base64_attachments) {
        var timestamp = decrypted.pushMessage.timestamp.toNumber();
        var m = this.messages().add({
          person: decrypted.pushMessage.source,
          threadId: this.id,
          body: decrypted.message.body,
          attachments: base64_attachments,
          type: 'incoming',
          timestamp: timestamp
        });
        m.save();

        if (timestamp > this.get('timestamp')) {
          this.set('timestamp', timestamp);
        }
        this.save({unreadCount: this.get('unreadCount') + 1, active: true});
        return m;
      }.bind(this));
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

    comparator: function(m) {
      return -m.get('timestamp');
    },

    findOrCreate: function(attributes) {
      var thread = Whisper.Threads.add(attributes, {merge: true});
      thread.save();
      return thread;
    },

    createGroup: function(recipients, name) {
      var attributes = {};
      attributes = {
        name      : name,
        numbers   : recipients,
        type      : 'group',
      };
      var thread = this.findOrCreate(attributes);
      return textsecure.messaging.createGroup(recipients, name).then(function(groupId) {
        thread.save({
          id      : getString(groupId),
          groupId : getString(groupId)
        });
        return thread;
      });
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
          groupId    : decrypted.message.group.id,
          name       : decrypted.message.group.name || 'New group',
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
    },

    addIncomingMessage: function(decrypted) {
        var thread = Whisper.Threads.findOrCreateForIncomingMessage(decrypted);
        return thread.receiveMessage(decrypted);
    }
  }))();
})();
