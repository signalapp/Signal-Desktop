/*global $, Whisper, Backbone, textsecure, extension*/
/*
 * vim: ts=4:sw=4:expandtab
 */

// This script should only be included in background.html
(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    var conversations = new Whisper.ConversationCollection();
    var inboxCollection = new (Backbone.Collection.extend({
        initialize: function() {
            this.on('change:active_at', this.sort);
            this.on('change:unreadCount', this.updateUnreadCount);

            this.listenTo(conversations, 'add change:active_at', this.addActive);
        },
        comparator: function(model) {
            return -model.get('active_at');
        },
        addActive: function(model) {
            if (model.get('active_at')) {
                this.add(model);
            } else {
                this.remove(model);
            }
        },
        updateUnreadCount: function(model, count) {
            var prev = model.previous('unreadCount') || 0;
            if (count < prev) { // decreased
                var newUnreadCount = storage.get("unreadCount", 0) - (prev - count);
                setUnreadCount(newUnreadCount);
                storage.put("unreadCount", newUnreadCount);
            }
        }
    }))();

    // Load the initial set of models for the inbox.
    conversations.fetchActive();

    window.getInboxCollection = function() {
        return inboxCollection;
    };

    window.ConversationController = {
        get: function(id) {
            return conversations.get(id);
        },
        create: function(attrs) {
            if (typeof attrs !== 'object') {
                throw new Error('ConversationController.create requires an object, got', attrs);
            }
            var conversation = conversations.add(attrs);
            return conversation;
        },
        findOrCreatePrivateById: function(id) {
            var conversation = conversations.add({ id: id, type: 'private' });
            return new Promise(function(resolve, reject) {
                conversation.fetch().then(function() {
                    resolve(conversation);
                }).fail(function() {
                    var saved = conversation.save(); // false or indexedDBRequest
                    if (saved) {
                        saved.then(function() {
                            resolve(conversation);
                        }).fail(reject);
                    } else {
                        reject();
                    }
                });
            });
        }
    };
})();
