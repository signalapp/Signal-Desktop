/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    extension.windows.getBackground(function(bg) {
        var SocketView = Whisper.View.extend({
            className: 'status',
            initialize: function() {
                setInterval(this.updateStatus.bind(this), 1000);
            },
            updateStatus: function() {
                extension.windows.getBackground(function(bg) {
                    var className, message = '';
                    switch(bg.getSocketStatus && bg.getSocketStatus()) {
                        case WebSocket.CONNECTING:
                            className = 'connecting';
                            break;
                        case WebSocket.OPEN:
                            className = 'open';
                            break;
                        case WebSocket.CLOSING:
                            className = 'closing';
                            break;
                        case WebSocket.CLOSED:
                            className = 'closed';
                            message = 'Disconnected';
                            break;
                    }
                    if (!this.$el.hasClass(className)) {
                        this.$el.attr('class', className);
                        this.$el.text(message);
                    }
                }.bind(this));
            },
            events: {
                'click': 'reloadBackgroundPage'
            },
            reloadBackgroundPage: function() {
                chrome.runtime.reload();
            }
        });

        Whisper.ConversationStack = Whisper.View.extend({
            className: 'conversation-stack',
            open: function(conversation) {
                var $el = this.$('#conversation-' + conversation.cid);
                if ($el === null || $el.length === 0) {
                    var view = new Whisper.ConversationView({
                        model: conversation,
                        appWindow: this.model.appWindow
                    });
                    $el = view.$el;
                    if (conversation.messageCollection.length === 0) {
                        $el.find('.message-list').addClass('loading');
                    }
                }
                $el.prependTo(this.el);
                $el.find('.message-list').trigger('reset-scroll');
                $el.trigger('force-resize');
                conversation.markRead();
            }
        });

        Whisper.InboxView = Whisper.View.extend({
            template: $('#two-column').html(),
            className: 'inbox',
            initialize: function (options) {
                this.render();
                this.conversation_stack = new Whisper.ConversationStack({
                    el: this.$('.conversation-stack'),
                    model: { appWindow: options.appWindow }
                });

                this.newConversationView = new Whisper.NewConversationView({
                    appWindow: options.appWindow
                });
                this.listenTo(this.newConversationView, 'open',
                    this.openConversation.bind(this, null));

                this.inbox = new Whisper.ConversationListView({
                    el         : this.$('.conversations'),
                    collection : bg.inbox
                }).render();

                this.inbox.listenTo(bg.inbox, 'sort', this.inbox.render);

                new SocketView().render().$el.appendTo(this.$('.socket-status'));

                extension.windows.beforeUnload(function() {
                    this.inbox.stopListening();
                }.bind(this));

                new Whisper.WindowControlsView({
                    appWindow: options.appWindow
                }).$el.appendTo(this.$('#header'));
            },
            events: {
                'click .fab': 'showCompose',
                'select .gutter .contact': 'openConversation'
            },
            openConversation: function(e, data) {
                var conversation = data.conversation;
                conversation.reload();
                this.conversation_stack.open(conversation);
                this.hideCompose();
            },
            showCompose: function() {
                this.newConversationView.reset();
                this.newConversationView.$el.prependTo(this.conversation_stack.el);
                this.newConversationView.$input.focus();
                this.listenToOnce(this.newConversationView, 'back', this.hideCompose);
            },
            hideCompose: function() {
                this.newConversationView.$el.remove();
            }
        });
    });

})();
