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
        name        : 'New Conversation',
        image       : '/images/default.png',
        unreadCount : 0,
        timestamp   : timestamp,
        active_at   : timestamp
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
        var now = Date.now();
        this.messageCollection.add({
            body           : message,
            conversationId : this.id,
            type           : 'outgoing',
            attachments    : attachments,
            sent_at        : now,
            received_at    : now
        }).save();

        this.save({
            unreadCount : 0,
            active_at   : now
        });

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
        options = options || {};
        options.index = {
            // 'conversation' index on conversationId
            // WHERE conversationId = this.id ORDER received_at DESC
            name  : 'conversation',
            lower : [this.id],
            upper : [this.id, Number.MAX_VALUE],
            order : 'desc'
        };
        return this.messageCollection.fetch(options);
        // TODO pagination/infinite scroll
        // limit: 10, offset: page*10,
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
        members   : recipients,
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
    },

    fetchGroups: function(number) {
        return this.fetch({
            index: {
                name: 'group',
                only: number
            }
        });
    }
  });
})();
