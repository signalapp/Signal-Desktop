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
            this.on('change:timestamp change:name change:number', this.sort);

            this.listenTo(conversations, 'add change:active_at', this.addActive);

            this.on('add remove change:unreadCount',
                _.debounce(this.updateUnreadCount.bind(this), 1000)
            );
            this.startPruning();
        },
        comparator: function(m1, m2) {
            var timestamp1 = m1.get('timestamp');
            var timestamp2 = m2.get('timestamp');
            if (timestamp1 && timestamp2) {
                return timestamp2 - timestamp1;
            }
            if (timestamp1) {
                return -1;
            }
            if (timestamp2) {
                return 1;
            }
            var title1 = m1.getTitle().toLowerCase();
            var title2 = m2.getTitle().toLowerCase();
            if (title1 ===  title2) {
                return 0;
            }
            if (title1 < title2) {
                return -1;
            }
            if (title1 > title2) {
                return 1;
            }
        },
        addActive: function(model) {
            if (model.get('active_at')) {
                this.add(model);
            } else {
                this.remove(model);
            }
        },
        updateUnreadCount: function() {
            var newUnreadCount = _.reduce(
                this.map(function(m) { return m.get('unreadCount'); }),
                function(item, memo) {
                    return item + memo;
                },
                0
            );
            storage.put("unreadCount", newUnreadCount);

            setUnreadCount(newUnreadCount);
            if (newUnreadCount === 0) {
                window.clearAttention();
            }
        },
        startPruning: function() {
            var halfHour = 30 * 60 * 1000;
            this.interval = setInterval(function() {
                this.forEach(function(conversation) {
                    conversation.trigger('prune');
                });
            }.bind(this), halfHour);
        }
    }))();

    window.getInboxCollection = function() {
        return inboxCollection;
    };

    window.ConversationController = {
        get: function(id) {
            return conversations.get(id);
        },
        createTemporary: function(attributes) {
            return conversations.add(attributes);
        },
        getOrCreate: function(id, type) {
            var conversation = conversations.get(id);
            if (conversation) {
                return conversation;
            }

            conversation = conversations.add({
                id: id,
                type: type
            });
            conversation.initialPromise = new Promise(function(resolve, reject) {
                var deferred = conversation.save();

                if (!deferred) {
                    console.log('Conversation save failed! ', id, type);
                    return reject(new Error('getOrCreate: Conversation save failed'));
                }

                deferred.then(function() {
                    resolve(conversation);
                }, reject);
            });

            return conversation;
        },
        getOrCreateAndWait: function(id, type) {
            var conversation = this.getOrCreate(id, type);

            if (conversation) {
                return conversation.initialPromise.then(function() {
                    return conversation;
                });
            }

            return Promise.reject(
                new Error('getOrCreateAndWait: did not get conversation')
            );
        },
        getAllGroupsInvolvingId: function(id) {
            var groups = new Whisper.GroupCollection();
            return groups.fetchGroups(id).then(function() {
                return groups.map(function(group) {
                    return conversations.add(group);
                });
            });
        },
        updateInbox: function() {
            return conversations.fetch();
        }
    };
})();
