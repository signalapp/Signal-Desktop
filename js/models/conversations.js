/* vim: ts=4:sw=4:expandtab
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
(function () {
  'use strict';

   window.Whisper = window.Whisper || {};

  var Conversation = Whisper.Conversation = Backbone.Model.extend({
    database: Whisper.Database,
    storeName: 'conversations',
    defaults: function() {
      var timestamp = new Date().getTime();
      return {
        unreadCount : 0,
        timestamp   : timestamp,
        active_at   : timestamp
      };
    },

    initialize: function() {
        this.messageCollection = new Whisper.MessageCollection();
    },

    validate: function(attributes, options) {
      var required = ['type', 'timestamp'];
      var missing = _.filter(required, function(attr) { return !attributes[attr]; });
      if (missing.length) { return "Conversation must have " + missing; }
    },

    sendMessage: function(body, attachments) {
        var now = Date.now();
        var message = this.messageCollection.add({
            body           : body,
            conversationId : this.id,
            type           : 'outgoing',
            attachments    : attachments,
            sent_at        : now,
            received_at    : now
        });
        message.save();

        this.save({
            unreadCount : 0,
            active_at   : now,
            timestamp   : now,
            lastMessage : body
        });

        var sendFunc;
        if (this.get('type') == 'private') {
            sendFunc = textsecure.messaging.sendMessageToNumber;
        }
        else {
            sendFunc = textsecure.messaging.sendMessageToGroup;
        }
        sendFunc(this.get('id'), body, attachments, now).catch(function(errors) {
            var keyErrors = [];
            _.each(errors, function(e) {
                if (e.error.name === 'OutgoingIdentityKeyError') {
                    e.error.args.push(message.id);
                    keyErrors.push(e.error);
                }
            });
            if (keyErrors.length) {
                message.save({ errors : keyErrors }).then(function() {
                    extension.trigger('message', message); // notify frontend listeners
                });
            } else {
                throw errors;
            }
        });
    },

    receiveMessage: function(decrypted) {
        var conversation = this;
        var timestamp = decrypted.pushMessage.timestamp.toNumber();
        var m = this.messageCollection.add({
            body           : decrypted.message.body,
            timestamp      : timestamp,
            conversationId : this.id,
            attachments    : decrypted.message.attachments,
            type           : 'incoming',
            sender         : decrypted.pushMessage.source
        });

        if (timestamp > this.get('timestamp')) {
          this.set('timestamp', timestamp);
        }
        this.save({unreadCount: this.get('unreadCount') + 1, active: true});

        return new Promise(function (resolve) { m.save().then(resolve(m)) });
    },

    fetchMessages: function(options) {
        return this.messageCollection.fetchConversation(this.id, options);
    },

    archive: function() {
        this.unset('active_at');
    },

    destroyMessages: function() {
        var models = this.messageCollection.models;
        this.messageCollection.reset([]);
        _.each(models, function(message) { message.destroy(); });
        this.archive();
        return this.save();
    },

    getTitle: function() {
        return this.get('name') || this.get('members') || this.id;
    }
  });

  Whisper.ConversationCollection = Backbone.Collection.extend({
    database: Whisper.Database,
    storeName: 'conversations',
    model: Conversation,

    comparator: function(m) {
      return -m.get('timestamp');
    },

    createGroup: function(recipients, name, avatar) {
      var attributes = {};
      attributes = {
        name      : name,
        members   : recipients,
        type      : 'group',
        avatar    : avatar
      };
      var conversation = this.add(attributes, {merge: true});
      return textsecure.messaging.createGroup(recipients, name, avatar).then(function(groupId) {
        conversation.save({
          id      : getString(groupId),
          groupId : getString(groupId)
        });
        return conversation;
      });
    },

    findOrCreateForRecipient: function(recipient) {
      var attributes = {};
      attributes = {
        id        : recipient,
        name      : recipient,
        type      : 'private',
      };
      var conversation = this.add(attributes, {merge: true});
      conversation.save();
      return conversation;
    },

    addIncomingMessage: function(decrypted) {
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
      var conversation = this.add(attributes, {merge: true});
      return conversation.receiveMessage(decrypted);
    },

    destroyAll: function () {
        return Promise.all(this.models.map(function(m) {
            return new Promise(function(resolve, reject) {
                m.destroy().then(resolve).fail(reject);
            });
        }));
    },

    fetchGroups: function(number) {
        return this.fetch({
            index: {
                name: 'group',
                only: number
            }
        });
    },

    fetchActive: function(options) {
        return this.fetch(_.extend(options, {
            index: {
                name: 'inbox', // 'inbox' index on active_at
                order: 'desc'  // ORDER timestamp DESC
            }
            // TODO pagination/infinite scroll
            // limit: 10, offset: page*10,
        }));
    }
  });
})();
