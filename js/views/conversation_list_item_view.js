/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    // list of conversations, showing user/group and last message sent
    Whisper.ConversationListItemView = Whisper.View.extend({
        tagName: 'div',
        className: 'conversation-list-item contact',
        templateName: 'conversation-preview',
        events: {
            'click': 'select'
        },
        initialize: function() {
            this.listenTo(this.model, 'change', this.render); // auto update
            this.listenTo(this.model, 'destroy', this.remove); // auto update
            extension.windows.beforeUnload(function() {
                this.stopListening();
            }.bind(this));
        },

        select: function(e) {
            this.$el.addClass('selected');
            this.$el.trigger('select', {conversation: this.model});
        },

        render: function() {
            this.$el.html(
                Mustache.render(_.result(this,'template', ''), {
                    title: this.model.getTitle(),
                    last_message: this.model.get('lastMessage'),
                    last_message_timestamp: moment(this.model.get('timestamp')).format('MMM D'),
                    number: this.model.getNumber(),
                    avatar: this.model.getAvatar()
                }, this.render_partials())
            );

            twemoji.parse(this.el, { base: '/images/twemoji/', size: 16 });

            var unread = this.model.get('unreadCount');
            if (unread > 0) {
                this.$el.addClass('unread');
            } else {
                this.$el.removeClass('unread');
            }

            return this;
        }

    });
})();
