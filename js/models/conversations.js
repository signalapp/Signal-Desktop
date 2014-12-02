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
      return {
        name: 'New Conversation',
        image: '/images/default.png',
        unreadCount: 0,
        timestamp: new Date().getTime(),
        active: true
      };
    },

    initialize: function() {
        this.messageCollection = new Whisper.MessageCollection();
    },

    validate: function(attributes, options) {
      var required = ['type', 'timestamp', 'image', 'name'];
      var missing = _.filter(required, function(attr) { return !attributes[attr]; });
      if (missing.length) { return "Conversation must have " + missing; }
    },

    sendMessage: function(message, attachments) {
        var timestamp = Date.now();
        this.messageCollection.add({
            body             : message,
            timestamp        : timestamp,
            conversationId   : this.id,
            conversationType : this.get('type'),
            type             : 'outgoing',
            attachments      : attachments,
        }).save();

        this.save({ timestamp:   timestamp,
                    unreadCount: 0,
                    active:      true});

        if (this.get('type') == 'private') {
          return textsecure.messaging.sendMessageToNumber(this.get('id'), message, attachments);
        }
        else {
          return textsecure.messaging.sendMessageToGroup(this.get('groupId'), message, attachments);
        }
    },

    receiveMessage: function(decrypted) {
        var conversation = this;
        var timestamp = decrypted.pushMessage.timestamp.toNumber();
        var m = this.messageCollection.add({
          body: decrypted.message.body,
          timestamp: timestamp,
          conversationId: this.id,
          conversationType: this.get('type'),
          attachments: decrypted.message.attachments,
          type: 'incoming',
          sender: decrypted.pushMessage.source
        });

        if (timestamp > this.get('timestamp')) {
          this.set('timestamp', timestamp);
        }
        this.save({unreadCount: this.get('unreadCount') + 1, active: true});

        return new Promise(function (resolve) { m.save().then(resolve(m)) });
    },

    fetchMessages: function(options) {
        options = options || {};
        options.conditions = {conversationId: this.id };
        return this.messageCollection.fetch(options);
    },

    destroyMessages: function() {
        var models = this.messageCollection.models;
        this.messageCollection.reset([]);
        _.each(models, function(message) { message.destroy(); });
        return this.save({active: false});
    }
  });

  Whisper.ConversationCollection = Backbone.Collection.extend({
    database: Whisper.Database,
    storeName: 'conversations',
    model: Conversation,

    comparator: function(m) {
      return -m.get('timestamp');
    },

    createGroup: function(recipients, name) {
      var attributes = {};
      attributes = {
        name      : name,
        numbers   : recipients,
        type      : 'group',
      };
      var conversation = this.add(attributes, {merge: true});
      return textsecure.messaging.createGroup(recipients, name).then(function(groupId) {
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
    }
  });
})();
