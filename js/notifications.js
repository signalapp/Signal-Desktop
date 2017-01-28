/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';
    window.Whisper = window.Whisper || {};

    var SETTINGS = {
        OFF     : 'off',
        COUNT   : 'count',
        NAME    : 'name',
        MESSAGE : 'message'
    };

    var sound = new Audio('/audio/NewMessage.mp3');

    Whisper.Notifications = new (Backbone.Collection.extend({
        initialize: function() {
            this.on('add', _.debounce(this.update.bind(this), 1000));
            this.on('remove', this.onRemove);
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
            console.log('updating notifications', this.length);
            extension.notification.clear();
            if (this.length === 0) {
                return;
            }
            var audioNotification = storage.get('audio-notification') || false;
            if (audioNotification) {
                sound.play();
            }

            var setting = storage.get('notification-setting') || 'message';
            if (setting === SETTINGS.OFF) {
                return;
            }

            var iconUrl = 'images/icon_128.png';
            var title = [
                this.length,
                this.length === 1 ? i18n('newMessage') : i18n('newMessages')
            ].join(' ');

            if (setting === SETTINGS.COUNT) {
                extension.notification.update({
                    type     : 'basic',
                    title    : title,
                    iconUrl  : iconUrl
                });
                return;
            }

            if (this.length > 1) {
                var conversationIds = _.uniq(this.map(function(m) {
                    return m.get('conversationId');
                }));
                if (conversationIds.length === 1 && this.showSender()) {
                    iconUrl = this.at(0).get('iconUrl');
                }
                extension.notification.update({
                    type    : 'list',
                    iconUrl : iconUrl,
                    title   : title,
                    message : 'Most recent from ' + this.last().get('title'),
                    items   : this.map(function(m) {
                        var message, title;
                        if (this.showMessage()) {
                            return {
                                title   : m.get('title'),
                                message : m.get('message')
                            };
                        } else if (this.showSender()) {
                            return {
                                title   : m.get('title'),
                                message : i18n('newMessage')
                            };
                        }
                    }.bind(this)),
                    buttons : [{
                        title   : 'Mark all as read',
                        iconUrl : 'images/check.svg'
                    }]
                });
            } else {
                var m = this.at(0);
                var type = 'basic';
                var message = i18n('newMessage');
                var imageUrl;
                if (this.showMessage()) {
                    message = m.get('message');
                    if (m.get('imageUrl')) {
                        type = 'image';
                        imageUrl = m.get('imageUrl');
                    }
                }
                if (this.showSender()) {
                    title = m.get('title');
                    iconUrl = m.get('iconUrl');
                }
                extension.notification.update({
                    type     : type,
                    title    : title,
                    message  : message,
                    iconUrl  : iconUrl,
                    imageUrl : imageUrl
                });
            }
        },
        getSetting: function() {
            return storage.get('notification-setting') || 'message';
        },
        showMessage: function() {
            return this.getSetting() === SETTINGS.MESSAGE;
        },
        showSender: function() {
            var setting = this.getSetting();
            return (setting === SETTINGS.MESSAGE || setting === SETTINGS.NAME);
        },
        onRemove: function() {
            console.log('remove notification');
            if (this.length === 0) {
                extension.notification.clear();
                return;
            }
        },
        clear: function() {
            this.reset([]);
        }
    }))();
})();
