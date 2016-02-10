/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.Notifications = new (Backbone.Collection.extend({
        initialize: function() {
            this.on('add', this.onAdd);
        },
        isEnabled: function(callback) {
            return Notification.permission === 'granted' &&
                !storage.get('disable-notifications');
        },
        enable: function(callback) {
            storage.remove('disable-notifications');
            Notification.requestPermission(function(status) {
                callback(status);
            });
        },
        disable: function() {
            storage.put('disable-notifications', true);
        },
        onclick: function() {
            var last = this.last();
            if (!last) {
                openInbox();
                return;
            }
            var conversation = ConversationController.create({
                id: last.get('conversationId')
            });
            openConversation(conversation);
            this.clear();
        },
        update: function() {
            if (this.length === 0) {
                extension.notification.clear();
                return;
            }
            if (this.length > 1) {
                var iconUrl = 'images/icon_128.png';
                var conversationIds = _.uniq(this.map(function(m) {
                    return m.get('conversationId');
                }));
                if (conversationIds.length === 1) {
                    iconUrl = this.at(0).get('iconUrl');
                }
                extension.notification.update({
                    type    : 'list',
                    iconUrl : iconUrl,
                    title   : '' + this.length + ' new messages',
                    message : 'Most recent from ' + this.last().get('title'),
                    items   : this.map(function(m) {
                        return {
                            title   : m.get('title'),
                            message : m.get('message')
                        };
                    }),
                    buttons : [{
                        title   : 'Mark all as read',
                        iconUrl : 'images/check.png'
                    }]
                });
            } else {
                var m = this.at(0);
                var type = 'basic';
                if (m.get('imageUrl')) {
                    type = 'image';
                }
                extension.notification.update({
                    type     : type,
                    title    : m.get('title'),
                    message  : m.get('message'),
                    iconUrl  : m.get('iconUrl'),
                    imageUrl : m.get('imageUrl')
                });
            }
        },
        onAdd: function() {
            extension.notification.clear();
            this.update();
        },
        clear: function() {
            this.reset([]);
        }
    }))();
})();
