/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    var SocketView = Whisper.View.extend({
        className: 'status',
        initialize: function() {
            setInterval(this.updateStatus.bind(this), 5000);
        },
        updateStatus: function() {
            var className, message = '';
            switch(getSocketStatus && getSocketStatus()) {
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
                    message = i18n('disconnected');
                    break;
            }
            if (!this.$el.hasClass(className)) {
                this.$el.attr('class', className);
                this.$el.text(message);
            }
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

            var inboxCollection = getInboxCollection();
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
            this.listenTo(this.searchView, 'open',
                this.openConversation.bind(this, null));

            new SocketView().render().$el.appendTo(this.$('.socket-status'));

            extension.windows.onClosed(function() {
                this.inboxListView.stopListening();
            }.bind(this));
        },
        render_attributes: {
            welcomeToSignal: i18n('welcomeToSignal'),
            selectAContact: i18n('selectAContact'),
            searchForPeopleOrGroups: i18n('searchForPeopleOrGroups'),
            submitDebugLog: i18n('submitDebugLog'),
            settings: i18n('settings'),
            restartSignal: i18n('restartSignal')
        },
        events: {
            'click': 'closeMenu',
            'click #header': 'focusHeader',
            'click .conversation': 'focusConversation',
            'click .global-menu .hamburger': 'toggleMenu',
            'click .show-debug-log': 'showDebugLog',
            'click .settings': 'showSettings',
            'select .gutter .conversation-list-item': 'openConversation',
            'input input.search': 'filterContacts',
            'click .restart-signal': 'reloadBackgroundPage'
        },
        focusConversation: function(e) {
            if (e && this.$(e.target).closest('.placeholder').length) {
                return;
            }

            this.$('#header').addClass('inactive');
            this.$('.conversation-stack').removeClass('inactive');
        },
        focusHeader: function() {
            this.$('.conversation-stack').addClass('inactive');
            this.$('#header').removeClass('inactive');
            this.$('.conversation:first .menu').trigger('close');
        },
        reloadBackgroundPage: function() {
            chrome.runtime.reload();
        },
        showSettings: function() {
            var view = new Whisper.SettingsView().render();
            view.update();
            view.$el.insertAfter(this.el);
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
        openConversation: function(e, conversation) {
            this.searchView.hideHints();
            conversation = ConversationController.create(conversation);
            this.conversation_stack.open(conversation);
            this.focusConversation();
        },
        toggleMenu: function() {
            this.$('.global-menu .menu-list').toggle();
        },
        showDebugLog: function() {
            this.$('.debug-log').remove();
            new Whisper.DebugLogView().$el.appendTo(this.el);
        },
        closeMenu: function(e) {
            if (e && this.$(e.target).parent('.global-menu').length > 0 ) {
                return;
            }

            this.$('.global-menu .menu-list').hide();
        }
    });

})();
