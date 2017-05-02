/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    Whisper.ConversationStack = Whisper.View.extend({
        className: 'conversation-stack',
        open: function(conversation) {
            var id = 'conversation-' + conversation.cid;
            if (id !== this.el.firstChild.id) {
                this.$el.first().find('video, audio').each(function() {
                    this.pause();
                });
                var $el = this.$('#'+id);
                if ($el === null || $el.length === 0) {
                    var view = new Whisper.ConversationView({
                        model: conversation,
                        window: this.model.window
                    });
                    $el = view.$el;
                }
                $el.prependTo(this.el);
                conversation.trigger('opened');
            }
        }
    });

    Whisper.FontSizeView = Whisper.View.extend({
        defaultSize: 14,
        maxSize: 30,
        minSize: 14,
        initialize: function() {
            this.currentSize = this.defaultSize;
            this.render();
        },
        events: { 'keydown': 'zoomText' },
        zoomText: function(e) {
            if (!e.ctrlKey) {
                return;
            }
            var keyCode = e.which || e.keyCode;
            var maxSize = 22; // if bigger text goes outside send-message textarea
            var minSize = 14;
            if (keyCode === 189 || keyCode == 109) {
                if (this.currentSize > minSize) {
                    this.currentSize--;
                }
            } else if (keyCode === 187 || keyCode == 107) {
                if (this.currentSize < maxSize) {
                    this.currentSize++;
                }
            }
            this.render();
        },
        render: function() {
            this.$el.css('font-size', this.currentSize + 'px');
        }
    });

    Whisper.InboxView = Whisper.View.extend({
        templateName: 'two-column',
        className: 'inbox',
        applyTheme: function() {
            var theme = storage.get('theme-setting') || 'android';
            this.$el.removeClass('ios')
                    .removeClass('android-dark')
                    .removeClass('android')
                    .addClass(theme);
        },
        initialize: function (options) {
            this.render();
            this.applyTheme();
            this.$el.attr('tabindex', '1');
            new Whisper.FontSizeView({ el: this.$el });
            this.conversation_stack = new Whisper.ConversationStack({
                el: this.$('.conversation-stack'),
                model: { window: options.window }
            });

            var inboxCollection = getInboxCollection();

            inboxCollection.on('messageError', function() {
                this.networkStatusView.render();
            }.bind(this));

            this.inboxListView = new Whisper.ConversationListView({
                el         : this.$('.inbox'),
                collection : inboxCollection
            }).render();

            this.inboxListView.listenTo(inboxCollection,
                    'add change:timestamp change:name change:number',
                    this.inboxListView.sort);

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

            this.networkStatusView = new Whisper.NetworkStatusView();
            this.$el.find('.network-status-container').append(this.networkStatusView.render().el);

            extension.windows.onClosed(function() {
                this.inboxListView.stopListening();
            }.bind(this));

            if (extension.expired()) {
                var banner = new Whisper.ExpiredAlertBanner().render();
                banner.$el.prependTo(this.$el);
                this.$el.addClass('expired');
            }
        },
        render_attributes: {
            welcomeToSignal         : i18n('welcomeToSignal'),
            selectAContact          : i18n('selectAContact'),
            searchForPeopleOrGroups : i18n('searchForPeopleOrGroups'),
            submitDebugLog          : i18n('submitDebugLog'),
            settings                : i18n('settings'),
            restartSignal           : i18n('restartSignal'),
        },
        events: {
            'click': 'onClick',
            'click #header': 'focusHeader',
            'click .conversation': 'focusConversation',
            'click .global-menu .hamburger': 'toggleMenu',
            'click .show-debug-log': 'showDebugLog',
            'click .showSettings': 'showSettings',
            'select .gutter .conversation-list-item': 'openConversation',
            'input input.search': 'filterContacts',
            'click .restart-signal': 'reloadBackgroundPage',
            'show .lightbox': 'showLightbox'
        },
        focusConversation: function(e) {
            if (e && this.$(e.target).closest('.placeholder').length) {
                return;
            }

            this.$('#header, .gutter').addClass('inactive');
            this.$('.conversation-stack').removeClass('inactive');
        },
        focusHeader: function() {
            this.$('.conversation-stack').addClass('inactive');
            this.$('#header, .gutter').removeClass('inactive');
            this.$('.conversation:first .menu').trigger('close');
        },
        reloadBackgroundPage: function() {
            chrome.runtime.reload();
        },
        showSettings: function() {
            var view = new Whisper.SettingsView();
            view.$el.appendTo(this.el);
            view.$el.on('change-theme', this.applyTheme.bind(this));
        },
        filterContacts: function(e) {
            this.searchView.filterContacts(e);
            var input = this.$('input.search');
            if (input.val().length > 0) {
                input.addClass('active');
                var textDir = window.getComputedStyle(input[0]).direction;
                if (textDir === 'ltr') {
                    input.removeClass('rtl').addClass('ltr');
                } else if (textDir === 'rtl') {
                    input.removeClass('ltr').addClass('rtl');
                }
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
        showLightbox: function(e) {
            this.$el.append(e.target);
        },
        closeRecording: function(e) {
            if (e && this.$(e.target).closest('.capture-audio').length > 0 ) {
                return;
            }
            this.$('.conversation:first .recorder').trigger('close');
        },
        closeMenu: function(e) {
            if (e && this.$(e.target).parent('.global-menu').length > 0 ) {
                return;
            }

            this.$('.global-menu .menu-list').hide();
        },
        onClick: function(e) {
            this.closeMenu(e);
            this.closeRecording(e);
        }
    });

    Whisper.ExpiredAlertBanner = Whisper.View.extend({
        templateName: 'expired_alert',
        className: 'expiredAlert clearfix',
        render_attributes: function() {
            return {
                expiredWarning: i18n('expiredWarning'),
                upgrade: i18n('upgrade'),
            };
        }
    });

})();
