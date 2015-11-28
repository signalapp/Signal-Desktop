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
                setInterval(this.updateStatus.bind(this), 5000);
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
                }
                $el.prependTo(this.el);
                conversation.trigger('opened');
            }
        });

        Whisper.InboxView = Whisper.View.extend({
            templateName: 'two-column',
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

                var inboxCollection = bg.getInboxCollection();
                this.inboxListView = new Whisper.ConversationListView({
                    el         : this.$('.inbox'),
                    collection : inboxCollection
                }).render();

                this.inboxListView.listenTo(inboxCollection,
                        'add change:active_at',
                        this.inboxListView.onChangeActiveAt);

                this.searchView = new Whisper.ConversationSearchView({
                    el    : this.$('.search-results'),
                    input : this.$('input.search')
                });

                this.searchView.$el.hide();

                this.listenTo(this.searchView, 'hide', function() {
                    this.searchView.$el.hide();
                    this.inboxListView.$el.show();
                });
                this.listenTo(this.searchView, 'show', function() {
                    this.searchView.$el.show();
                    this.inboxListView.$el.hide();
                });

                this.hintView = new Whisper.HintView({
                    className: 'conversation placeholder',
                    content: "Select a contact or group to start chatting."
                });
                if (inboxCollection.length === 0) {
                    this.hintView.render();
                    this.hintView.$el.prependTo(this.$('.conversation-stack'));
                    this.searchView.showAllContacts = true;
                    this.searchView.reset();
                    this.listenToOnce(inboxCollection, 'add', function() {
                        this.searchView.showAllContacts = false;
                        this.searchView.reset();
                    }.bind(this));
                }

                new SocketView().render().$el.appendTo(this.$('.socket-status'));

                extension.windows.onClosed(function() {
                    this.inboxListView.stopListening();
                }.bind(this));
            },
            events: {
                'click': 'closeMenu',
                'click .hamburger': 'toggleMenu',
                'click .show-debug-log': 'showDebugLog',
                'click .show-new-conversation': 'showCompose',
                'select .gutter .contact': 'openConversation',
                'input input.search': 'filterContacts'
            },
            filterContacts: function(e) {
                this.searchView.filterContacts(e);
                var input = this.$('input.search');
                if (input.val().length > 0) {
                    input.addClass('active');
                } else {
                    input.removeClass('active');
                }
            },
            hideHints: function() {
                this.hintView.remove();
                this.searchView.hideHints();
            },
            openConversation: function(e, conversation) {
                this.hideHints();
                conversation = ConversationController.create(conversation);
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
            },
            toggleMenu: function() {
                this.$('.global-menu .menu-list').toggle();
            },
            showDebugLog: function() {
                this.$('.debug-log').remove();
                new Whisper.DebugLogView().$el.appendTo(this.el);
            },
            closeMenu: function(e) {
                if (e && !$(e.target).hasClass('hamburger')) {
                    this.$('.global-menu .menu-list').hide();
                }
            }
        });
    });

})();
