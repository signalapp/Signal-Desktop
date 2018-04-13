/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.ExpiredToast = Whisper.ToastView.extend({
        render_attributes: function() {
            return { toastMessage: i18n('expiredWarning') };
        }
    });
    Whisper.BlockedToast = Whisper.ToastView.extend({
        render_attributes: function() {
            return { toastMessage: i18n('unblockToSend') };
        }
    });
    Whisper.LeftGroupToast = Whisper.ToastView.extend({
        render_attributes: function() {
            return { toastMessage: i18n('youLeftTheGroup') };
        }
    });

    var MenuView = Whisper.View.extend({
        toggleMenu: function() {
            this.$('.menu-list').toggle();
        }
    });

    var TimerMenuView = MenuView.extend({
        initialize: function() {
            this.render();
            this.listenTo(this.model, 'change:expireTimer', this.render);
        },
        events: {
          'click button': 'toggleMenu',
          'click li': 'setTimer'
        },
        setTimer: function(e) {
            var seconds = this.$(e.target).data().seconds;
            if (seconds > 0) {
                this.model.updateExpirationTimer(seconds);
            } else {
                this.model.updateExpirationTimer(null);
            }
        },
        render: function() {
            var seconds = this.model.get('expireTimer');
            if (seconds) {
              var s = Whisper.ExpirationTimerOptions.getAbbreviated(seconds);
              this.$el.attr('data-time', s);
              this.$el.show();
            } else {
              this.$el.attr('data-time', null);
              this.$el.hide();
            }
        }
    });

    Whisper.ConversationLoadingScreen = Whisper.View.extend({
        templateName: 'conversation-loading-screen',
        className: 'conversation-loading-screen'
    });

    Whisper.ConversationTitleView = Whisper.View.extend({
        templateName: 'conversation-title',
        initialize: function() {
            this.listenTo(this.model, 'change', this.render);
        },
        render_attributes: function() {
            return {
                isVerified: this.model.isVerified(),
                verified: i18n('verified'),
                name: this.model.getName(),
                number: this.model.getNumber(),
                profileName: this.model.getProfileName()
            };
        }
    });

    Whisper.ConversationView = Whisper.View.extend({
        className: function() {
            return [ 'conversation', this.model.get('type') ].join(' ');
        },
        id: function() {
            return 'conversation-' + this.model.cid;
        },
        template: $('#conversation').html(),
        render_attributes: function() {
            return {
                group: this.model.get('type') === 'group',
                isMe: this.model.isMe(),
                avatar: this.model.getAvatar(),
                expireTimer: this.model.get('expireTimer'),
                'show-members'    : i18n('showMembers'),
                'end-session'     : i18n('resetSession'),
                'show-identity'   : i18n('showSafetyNumber'),
                'destroy'         : i18n('deleteMessages'),
                'send-message'    : i18n('sendMessage'),
                'disappearing-messages': i18n('disappearingMessages'),
                'android-length-warning': i18n('androidMessageLengthWarning'),
                timer_options     : Whisper.ExpirationTimerOptions.models
            };
        },
        initialize: function(options) {
            this.listenTo(this.model, 'destroy', this.stopListening);
            this.listenTo(this.model, 'change:verified', this.onVerifiedChange);
            this.listenTo(this.model, 'change:color', this.updateColor);
            this.listenTo(this.model, 'change:avatar change:profileAvatar', this.updateAvatar);
            this.listenTo(this.model, 'newmessage', this.addMessage);
            this.listenTo(this.model, 'delivered', this.updateMessage);
            this.listenTo(this.model, 'read', this.updateMessage);
            this.listenTo(this.model, 'opened', this.onOpened);
            this.listenTo(this.model, 'expired', this.onExpired);
            this.listenTo(this.model, 'prune', this.onPrune);
            this.listenTo(this.model.messageCollection, 'expired', this.onExpiredCollection);
            this.listenTo(this.model.messageCollection, 'scroll-to-message', this.scrollToMessage);

            this.lazyUpdateVerified = _.debounce(
                this.model.updateVerified.bind(this.model),
                1000 // one second
            );
            this.throttledGetProfiles = _.throttle(
                this.model.getProfiles.bind(this.model),
                1000 * 60 * 5 // five minutes
            );

            this.render();

            this.loadingScreen = new Whisper.ConversationLoadingScreen();
            this.loadingScreen.render();
            this.loadingScreen.$el.prependTo(this.el);

            this.timerMenu = new TimerMenuView({ el: this.$('.timer-menu'), model: this.model });

            emoji_util.parse(this.$('.conversation-name'));

            this.window = options.window;
            this.fileInput = new Whisper.FileInputView({
                el: this.$('form.send'),
                window: this.window
            });

            this.titleView = new Whisper.ConversationTitleView({
                el: this.$('.conversation-title'),
                model: this.model
            });
            this.titleView.render();

            this.view = new Whisper.MessageListView({
                collection: this.model.messageCollection,
                window: this.window
            });
            this.$('.discussion-container').append(this.view.el);
            this.view.render();

            this.$messageField = this.$('.send-message');

            this.onResize = this.forceUpdateMessageFieldSize.bind(this);
            this.window.addEventListener('resize', this.onResize);

            this.onFocus = function() {
                if (this.$el.css('display') !== 'none') {
                    this.markRead();
                }
            }.bind(this);
            this.window.addEventListener('focus', this.onFocus);

            extension.windows.onClosed(function () {
                this.unload('windows closed');
            }.bind(this));

            this.fetchMessages();

            this.$('.send-message').focus(this.focusBottomBar.bind(this));
            this.$('.send-message').blur(this.unfocusBottomBar.bind(this));

            this.$emojiPanelContainer = this.$('.emoji-panel-container');
        },

        events: {
            'submit .send': 'checkUnverifiedSendMessage',
            'input .send-message': 'updateMessageFieldSize',
            'keydown .send-message': 'updateMessageFieldSize',
            'click .destroy': 'destroyMessages',
            'click .end-session': 'endSession',
            'click .leave-group': 'leaveGroup',
            'click .update-group': 'newGroupUpdate',
            'click .show-identity': 'showSafetyNumber',
            'click .show-members': 'showMembers',
            'click .conversation-menu .hamburger': 'toggleMenu',
            'click' : 'onClick',
            'click .bottom-bar': 'focusMessageField',
            'click .back': 'resetPanel',
            'click .microphone': 'captureAudio',
            'click .disappearing-messages': 'enableDisappearingMessages',
            'click .scroll-down-button-view': 'scrollToBottom',
            'click button.emoji': 'toggleEmojiPanel',
            'focus .send-message': 'focusBottomBar',
            'change .file-input': 'toggleMicrophone',
            'blur .send-message': 'unfocusBottomBar',
            'loadMore .message-list': 'loadMoreMessages',
            'newOffscreenMessage .message-list': 'addScrollDownButtonWithCount',
            'atBottom .message-list': 'removeScrollDownButton',
            'farFromBottom .message-list': 'addScrollDownButton',
            'lazyScroll .message-list': 'onLazyScroll',
            'close .menu': 'closeMenu',
            'select .message-list .entry': 'messageDetail',
            'force-resize': 'forceUpdateMessageFieldSize',
            'show-identity': 'showSafetyNumber',
            'dragover': 'sendToFileInput',
            'drop': 'sendToFileInput',
            'dragleave': 'sendToFileInput'
        },
        sendToFileInput: function(e) {
            if (e.originalEvent.dataTransfer.types[0] != 'Files') {
                return;
            }
            this.fileInput.$el.trigger(e);
        },

        onPrune: function() {
            if (!this.model.messageCollection.length || !this.lastActivity) {
                return;
            }

            var oneHourAgo = Date.now() - 60 * 60 * 1000;
            if (this.isHidden() && this.lastActivity < oneHourAgo) {
                this.unload('inactivity');
            } else if (this.view.atBottom()) {
                this.trim();
            }
        },

        unload: function(reason) {
            console.log(
                'unloading conversation',
                this.model.idForLogging(),
                'due to:',
                reason
            );

            this.timerMenu.remove();
            this.fileInput.remove();
            this.titleView.remove();

            if (this.captureAudioView) {
                this.captureAudioView.remove();
            }
            if (this.banner) {
                this.banner.remove();
            }
            if (this.lastSeenIndicator) {
                this.lastSeenIndicator.remove();
            }
            if (this.scrollDownButton) {
                this.scrollDownButton.remove();
            }
            if (this.panels && this.panels.length) {
                for (var i = 0, max = this.panels.length; i < max; i += 1) {
                    var panel = this.panels[i];
                    panel.remove();
                }
            }

            this.window.removeEventListener('resize', this.onResize);
            this.window.removeEventListener('focus', this.onFocus);

            window.autosize.destroy(this.$messageField);

            this.view.remove();

            this.remove();

            this.model.messageCollection.forEach(function(model) {
                model.trigger('unload');
            });
            this.model.messageCollection.reset([]);
        },

        trim: function() {
            var MAX = 100;
            var toRemove = this.model.messageCollection.length - MAX;
            if (toRemove <= 0) {
                return;
            }

            var models = [];
            for (var i = 0; i < toRemove; i += 1) {
                var model = this.model.messageCollection.at(i);
                models.push(model);
            }

            if (!models.length) {
                return;
            }

            console.log(
                'trimming conversation',
                this.model.idForLogging(),
                'of',
                models.length,
                'old messages'
            );

            this.model.messageCollection.remove(models);
            _.forEach(models, function(model) {
                model.trigger('unload');
            });
        },

        markAllAsVerifiedDefault: function(unverified) {
            return Promise.all(unverified.map(function(contact) {
                if (contact.isUnverified()) {
                    return contact.setVerifiedDefault();
                }
            }.bind(this)));
        },


        markAllAsApproved: function(untrusted) {
            return Promise.all(untrusted.map(function(contact) {
                return contact.setApproved();
            }.bind(this)));
        },

        openSafetyNumberScreens: function(unverified) {
            if (unverified.length === 1) {
                this.showSafetyNumber(null, unverified.at(0));
                return;
            }

            this.showMembers(null, unverified, {needVerify: true});
        },

        onVerifiedChange: function() {
            if (this.model.isUnverified()) {
                var unverified = this.model.getUnverified();
                var message;
                if (!unverified.length) {
                    return;
                }
                if (unverified.length > 1) {
                    message = i18n('multipleNoLongerVerified');
                } else {
                    message = i18n('noLongerVerified', unverified.at(0).getTitle());
                }

                // Need to re-add, since unverified set may have changed
                if (this.banner) {
                    this.banner.remove();
                    this.banner = null;
                }

                this.banner = new Whisper.BannerView({
                    message: message,
                    onDismiss: function() {
                        this.markAllAsVerifiedDefault(unverified);
                    }.bind(this),
                    onClick: function() {
                        this.openSafetyNumberScreens(unverified);
                    }.bind(this)
                });

                var container = this.$('.discussion-container');
                container.append(this.banner.el);
            } else if (this.banner) {
                this.banner.remove();
                this.banner = null;
            }
        },

        enableDisappearingMessages: function() {
            if (!this.model.get('expireTimer')) {
                this.model.updateExpirationTimer(
                    moment.duration(1, 'day').asSeconds()
                );
            }
        },
        toggleMicrophone: function() {
            if (this.$('.send-message').val().length > 0 || this.fileInput.hasFiles()) {
                this.$('.capture-audio').hide();
            } else {
                this.$('.capture-audio').show();
            }
        },
        toggleLengthWarning: function() {
            if (this.$('.send-message').val().length > 2000) {
                this.$('.android-length-warning').show();
            } else {
                this.$('.android-length-warning').hide();
            }
        },
        captureAudio: function(e) {
            e.preventDefault();

            // Note - clicking anywhere will close the audio capture panel, due to
            //   the onClick handler in InboxView, which calls its closeRecording method.

            if (this.captureAudioView) {
                this.captureAudioView.remove();
                this.captureAudioView = null;
            }

            var view = this.captureAudioView = new Whisper.RecorderView();
            view.render();
            view.on('send', this.handleAudioCapture.bind(this));
            view.on('closed', this.endCaptureAudio.bind(this));
            view.$el.appendTo(this.$('.capture-audio'));

            this.$('.send-message').attr('disabled', true);
            this.$('.microphone').hide();
        },
        handleAudioCapture: function(blob) {
            this.fileInput.file = blob;
            this.fileInput.isVoiceNote = true;
            this.fileInput.previewImages();
            this.$('.bottom-bar form').submit();
        },
        endCaptureAudio: function() {
            this.$('.send-message').removeAttr('disabled');
            this.$('.microphone').show();
            this.captureAudioView = null;
        },

        unfocusBottomBar: function() {
            this.$('.bottom-bar form').removeClass('active');
        },
        focusBottomBar: function() {
            this.$('.bottom-bar form').addClass('active');
        },

        onLazyScroll: function() {
            // The in-progress fetch check is important, because while that happens, lots
            //   of messages are added to the DOM, one by one, changing window size and
            //   generating scroll events.
            if (!this.isHidden() && window.isFocused() && !this.inProgressFetch) {
                this.lastActivity = Date.now();
                this.markRead();
            }
        },
        updateUnread: function() {
            this.resetLastSeenIndicator();
            // Waiting for scrolling caused by resetLastSeenIndicator to settle down
            setTimeout(this.markRead.bind(this), 1);
        },

        onLoaded: function () {
            var view = this.loadingScreen;
            if (view) {
                var openDelta = Date.now() - this.openStart;
                console.log(
                    'Conversation',
                    this.model.idForLogging(),
                    'took',
                    openDelta,
                    'milliseconds to load'
                );
                this.loadingScreen = null;
                view.remove();
            }
        },

        onOpened: function() {
            this.openStart = Date.now();
            this.lastActivity = Date.now();

            this.statusFetch = this.throttledGetProfiles().then(function() {
                return this.model.updateVerified().then(function() {
                    this.onVerifiedChange();
                    this.statusFetch = null;
                    console.log('done with status fetch');
                }.bind(this));
            }.bind(this));

            // We schedule our catch-up decrypt right after any in-progress fetch of
            //   messages from the database, then ensure that the loading screen is only
            //   dismissed when that is complete.
            var messagesLoaded = this.inProgressFetch || Promise.resolve();

            messagesLoaded
                .then(this.model.decryptOldIncomingKeyErrors.bind(this))
                .then(this.onLoaded.bind(this), this.onLoaded.bind(this));

            this.view.resetScrollPosition();
            this.$el.trigger('force-resize');
            this.focusMessageField();

            if (this.inProgressFetch) {
                this.inProgressFetch.then(this.updateUnread.bind(this));
            } else {
                this.updateUnread();
            }
        },

        addScrollDownButtonWithCount: function() {
            this.updateScrollDownButton(1);
        },

        addScrollDownButton: function() {
            if (!this.scrollDownButton) {
                this.updateScrollDownButton();
            }
        },

        updateScrollDownButton: function(count) {
            if (this.scrollDownButton) {
                this.scrollDownButton.increment(count);
            } else {
                this.scrollDownButton = new Whisper.ScrollDownButtonView({count: count});
                this.scrollDownButton.render();
                var container = this.$('.discussion-container');
                container.append(this.scrollDownButton.el);
            }
        },

        removeScrollDownButton: function() {
            if (this.scrollDownButton) {
                var button = this.scrollDownButton;
                this.scrollDownButton = null;
                button.remove();
            }
        },

        removeLastSeenIndicator: function() {
            if (this.lastSeenIndicator) {
                var indicator = this.lastSeenIndicator;
                this.lastSeenIndicator = null;
                indicator.remove();
            }
        },

        scrollToMessage: function(options = {}) {
            const { id } = options;

            if (!id) {
                return;
            }

            const el = this.$(`#${id}`);
            if (!el || el.length === 0) {
                return;
            }

            el[0].scrollIntoView();
        },

        scrollToBottom: function() {
            // If we're above the last seen indicator, we should scroll there instead
            // Note: if we don't end up at the bottom of the conversation, button will not go away!
            if (this.lastSeenIndicator) {
                var location = this.lastSeenIndicator.$el.position().top;
                if (location > 0) {
                    this.lastSeenIndicator.el.scrollIntoView();
                    return;
                } else {
                    this.removeLastSeenIndicator();
                }
            }
            this.view.scrollToBottom();
        },

        resetLastSeenIndicator: function(options) {
            options = options || {};
            _.defaults(options, {scroll: true});

            var unreadCount = 0;
            var oldestUnread = null;

            // We need to iterate here because unseen non-messages do not contribute to
            //   the badge number, but should be reflected in the indicator's count.
            this.model.messageCollection.forEach(function(model) {
                if (!model.get('unread')) {
                    return;
                }

                unreadCount += 1;
                if (!oldestUnread) {
                    oldestUnread = model;
                }
            });

            this.removeLastSeenIndicator();

            if (oldestUnread) {
                this.lastSeenIndicator = new Whisper.LastSeenIndicatorView({count: unreadCount});
                var lastSeenEl = this.lastSeenIndicator.render().$el;

                lastSeenEl.insertBefore(this.$('#' + oldestUnread.get('id')));

                if (this.view.atBottom() || options.scroll) {
                    lastSeenEl[0].scrollIntoView();
                }

                // scrollIntoView is an async operation, but we have no way to listen for
                //   completion of the resultant scroll.
                setTimeout(function() {
                    if (!this.view.atBottom()) {
                        this.addScrollDownButtonWithCount(unreadCount);
                    }
                }.bind(this), 1);
            }
        },

        focusMessageField: function() {
            this.$messageField.focus();
        },

        focusMessageFieldAndClearDisabled: function() {
            this.$messageField.removeAttr('disabled');
            this.$messageField.focus();
        },

        loadMoreMessages: function() {
            if (this.inProgressFetch) {
                return;
            }

            this.view.measureScrollPosition();
            var startingHeight = this.view.scrollHeight;

            this.fetchMessages().then(function() {
                // We delay this work to let scrolling/layout settle down first
                setTimeout(function() {
                    this.view.measureScrollPosition();
                    var endingHeight = this.view.scrollHeight;
                    var delta = endingHeight - startingHeight;

                    var newScrollPosition = this.view.scrollPosition + delta - this.view.outerHeight;
                    this.view.$el.scrollTop(newScrollPosition);
                }.bind(this), 1);
            }.bind(this));
        },

        fetchMessages: function() {
            console.log('fetchMessages');
            this.$('.bar-container').show();
            if (this.inProgressFetch) {
              console.log('Multiple fetchMessage calls!');
            }
            this.inProgressFetch = this.model.fetchContacts().then(function() {
                return this.model.fetchMessages().then(function() {
                    this.$('.bar-container').hide();
                    this.model.messageCollection.where({unread: 1}).forEach(function(m) {
                        m.fetch();
                    });
                    this.inProgressFetch = null;
                }.bind(this));
            }.bind(this)).catch(function(error) {
                console.log('fetchMessages error:', error && error.stack ? error.stack : error);
                this.inProgressFetch = null;
            }.bind(this));

            return this.inProgressFetch;
        },

        onExpired: function(message) {
            var mine = this.model.messageCollection.get(message.id);
            if (mine && mine.cid !== message.cid) {
                mine.trigger('expired', mine);
            }
        },
        onExpiredCollection: function(message) {
            var removeMessage = function() {
                console.log(
                    'removing message',
                    message.get('sent_at'),
                    'from collection'
                );
                this.model.messageCollection.remove(message.id);
            }.bind(this);

            // If a fetch is in progress, then we need to wait until that's complete to
            //   do this removal. Otherwise we could remove from messageCollection, then
            //   the async database fetch could include the removed message.

            if (this.inProgressFetch) {
                this.inProgressFetch.then(removeMessage);
            } else {
                removeMessage();
            }
        },

        addMessage: function(message) {
            // This is debounced, so it won't hit the database too often.
            this.lazyUpdateVerified();

            this.model.addSingleMessage(message);
            message.setToExpire();

            if (message.isOutgoing()) {
                this.removeLastSeenIndicator();
            }
            if (this.lastSeenIndicator) {
                this.lastSeenIndicator.increment(1);
            }

            if (!this.isHidden() && !window.isFocused()) {
                // The conversation is visible, but window is not focused
                if (!this.lastSeenIndicator) {
                    this.resetLastSeenIndicator({scroll: false});
                } else if (this.view.atBottom() && this.model.get('unreadCount') === this.lastSeenIndicator.getCount()) {
                    // The count check ensures that the last seen indicator is still in
                    //   sync with the real number of unread, so we can scroll to it.
                    //   We only do this if we're at the bottom, because that signals that
                    //   the user is okay with us changing scroll around so they see the
                    //   right unseen message first.
                    this.resetLastSeenIndicator({scroll: true});
                }
            }
            else if (!this.isHidden() && window.isFocused()) {
                // The conversation is visible and in focus
                this.markRead();

                // When we're scrolled up and we don't already have a last seen indicator
                //   we add a new one.
                if (!this.view.atBottom() && !this.lastSeenIndicator) {
                    this.resetLastSeenIndicator({scroll: false});
                }
            }
        },
        updateMessage: function(message) {
            this.model.messageCollection.add(message, {merge: true});
        },

        onClick: function(e) {
            // If there are sub-panels open, we don't want to respond to clicks
            if (!this.panels || !this.panels.length) {
                this.closeMenu(e);
                this.markRead();
            }
        },

        findNewestVisibleUnread: function() {
            var collection = this.model.messageCollection;
            var length = collection.length;
            var viewportBottom = this.view.outerHeight;
            var unreadCount = this.model.get('unreadCount') || 0;

            // Start with the most recent message, search backwards in time
            var foundUnread = 0;
            for (var i = length - 1; i >= 0; i -= 1) {
                // Search the latest 30, then stop if we believe we've covered all known
                //   unread messages. The unread should be relatively recent.
                // Why? local notifications can be unread but won't be reflected the
                //   conversation's unread count.
                if (i > 30 && foundUnread >= unreadCount) {
                    return;
                }

                var message = collection.at(i);
                if (!message.get('unread')) {
                    continue;
                }

                foundUnread += 1;

                var el = this.$('#' + message.id);
                var position = el.position();
                var top = position.top;

                // We're fully below the viewport, continue searching up.
                if (top > viewportBottom) {
                    continue;
                }

                // If the bottom fits on screen, we'll call it visible. Even if the
                //   message is really tall.
                var height = el.height();
                var bottom = top + height;
                if (bottom <= viewportBottom) {
                    return message;
                }

                // Continue searching up.
            }
        },

        markRead: function() {
            var unread;

            if (this.view.atBottom()) {
                unread = this.model.messageCollection.last();
            } else {
                unread = this.findNewestVisibleUnread();
            }

            if (unread) {
                this.model.markRead(unread.get('received_at'));
            }
        },

        showMembers: function(e, members, options) {
            options = options || {};
            _.defaults(options, {needVerify: false});

            members = members || this.model.contactCollection;

            var view = new Whisper.GroupMemberList({
                model: members,
                // we pass this in to allow nested panels
                listenBack: this.listenBack.bind(this),
                needVerify: options.needVerify
            });

            this.listenBack(view);
        },

        showSafetyNumber: function(e, model) {
            if (!model && this.model.isPrivate()) {
                model = this.model;
            }
            if (model) {
                var view = new Whisper.KeyVerificationPanelView({
                    model: model
                });
                this.listenBack(view);
            }
        },

        messageDetail: function(e, data) {
            var view = new Whisper.MessageDetailView({
                model: data.message,
                conversation: this.model,
                // we pass these in to allow nested panels
                listenBack: this.listenBack.bind(this),
                resetPanel: this.resetPanel.bind(this)
            });
            this.listenBack(view);
            view.render();
        },

        // not currently in use
        newGroupUpdate: function() {
            var view = new Whisper.NewGroupUpdateView({
                model: this.model,
                window: this.window
            });
            view.render();
            this.listenBack(view);
        },

        listenBack: function(view) {
            this.panels = this.panels || [];
            if (this.panels.length > 0) {
                this.panels[0].$el.hide();
            }
            this.panels.unshift(view);

            if (this.panels.length === 1) {
                this.$('.main.panel, .header-buttons.right').hide();
                this.$('.back').show();
            }

            view.$el.insertBefore(this.$('.panel').first());
        },
        resetPanel: function() {
            var view = this.panels.shift();
            if (this.panels.length > 0) {
                this.panels[0].$el.show();
            }
            view.remove();

            if (this.panels.length === 0) {
                this.$('.main.panel, .header-buttons.right').show();
                this.$('.back').hide();
                this.$el.trigger('force-resize');
            }
        },

        closeMenu: function(e) {
            if (e && !$(e.target).hasClass('hamburger')) {
                this.$('.conversation-menu .menu-list').hide();
            }
            if (e && !$(e.target).hasClass('clock')) {
                this.$('.timer-menu .menu-list').hide();
            }
        },

        endSession: function() {
            this.model.endSession();
            this.$('.menu-list').hide();
        },

        leaveGroup: function() {
            this.model.leaveGroup();
            this.$('.menu-list').hide();
        },

        toggleMenu: function() {
            this.$('.conversation-menu .menu-list').toggle();
        },

        destroyMessages: function(e) {
            this.confirm(i18n('deleteConversationConfirmation')).then(function() {
                this.model.destroyMessages();
                this.remove();
            }.bind(this)).catch(function() {
                // clicked cancel, nothing to do.
            });
            this.$('.menu-list').hide();
        },

        showSendConfirmationDialog: function(e, contacts) {
            var message;
            var isUnverified = this.model.isUnverified();

            if (contacts.length > 1) {
                if (isUnverified) {
                    message = i18n('changedSinceVerifiedMultiple');
                } else {
                    message = i18n('changedRecentlyMultiple');
                }
            } else {
                var contactName = contacts.at(0).getTitle();
                if (isUnverified) {
                    message = i18n('changedSinceVerified', [contactName, contactName]);
                } else {
                    message = i18n('changedRecently', [contactName, contactName]);
                }
            }

            var dialog = new Whisper.ConfirmationDialogView({
                message: message,
                okText: i18n('sendAnyway'),
                resolve: function() {
                    this.checkUnverifiedSendMessage(e, {force: true});
                }.bind(this),
                reject: function() {
                    this.focusMessageFieldAndClearDisabled();
                }.bind(this)
            });

            this.$el.prepend(dialog.el);
            dialog.focusCancel();
        },

        checkUnverifiedSendMessage: function(e, options) {
            e.preventDefault();
            this.sendStart = Date.now();
            this.$messageField.attr('disabled', true);

            options = options || {};
            _.defaults(options, {force: false});

            // This will go to the trust store for the latest identity key information,
            //   and may result in the display of a new banner for this conversation.
            this.model.updateVerified().then(function() {
                var contacts = this.model.getUnverified();
                if (!contacts.length) {
                    return this.checkUntrustedSendMessage(e, options);
                }

                if (options.force) {
                    return this.markAllAsVerifiedDefault(contacts).then(function() {
                        this.checkUnverifiedSendMessage(e, options);
                    }.bind(this));
                }

                this.showSendConfirmationDialog(e, contacts);
            }.bind(this)).catch(function(error) {
                this.focusMessageFieldAndClearDisabled();
                console.log(
                    'checkUnverifiedSendMessage error:',
                    error && error.stack ? error.stack : error
                );
            }.bind(this));
        },

        checkUntrustedSendMessage: function(e, options) {
            options = options || {};
            _.defaults(options, {force: false});

            this.model.getUntrusted().then(function(contacts) {
                if (!contacts.length) {
                    return this.sendMessage(e);
                }

                if (options.force) {
                    return this.markAllAsApproved(contacts).then(function() {
                        this.sendMessage(e);
                    }.bind(this));
                }

                this.showSendConfirmationDialog(e, contacts);
            }.bind(this)).catch(function(error) {
                this.focusMessageFieldAndClearDisabled();
                console.log(
                    'checkUntrustedSendMessage error:',
                    error && error.stack ? error.stack : error
                );
            }.bind(this));
        },

        toggleEmojiPanel: function(e) {
            e.preventDefault();
            if (!this.emojiPanel) {
              this.openEmojiPanel();
            } else {
              this.closeEmojiPanel();
            }
        },
        openEmojiPanel: function(e) {
            this.$emojiPanelContainer.outerHeight(200);
            this.emojiPanel = new EmojiPanel(this.$emojiPanelContainer[0], {
              onClick: this.insertEmoji.bind(this)
            });
            this.updateMessageFieldSize({});
        },
        closeEmojiPanel: function() {
            this.$emojiPanelContainer.empty().outerHeight(0);
            this.emojiPanel = null;
            this.updateMessageFieldSize({});
        },
        insertEmoji: function(e) {
            var colons = ':' + emojiData[e.index].short_name + ':';

            var textarea = this.$messageField[0];
            if (textarea.selectionStart || textarea.selectionStart == '0') {
                var startPos = textarea.selectionStart;
                var endPos = textarea.selectionEnd;
                textarea.value = textarea.value.substring(0, startPos)
                    + colons
                    + textarea.value.substring(endPos, textarea.value.length);
                textarea.selectionStart = startPos + colons.length;
                textarea.selectionEnd = startPos + colons.length;
            } else {
                textarea.value += colons;
            }
            this.focusMessageField();
        },
        sendMessage: function(e) {
            this.removeLastSeenIndicator();
            this.closeEmojiPanel();

            var toast;
            if (extension.expired()) {
                toast = new Whisper.ExpiredToast();
            }
            if (this.model.isPrivate() && storage.isBlocked(this.model.id)) {
                toast = new Whisper.BlockedToast();
            }
            if (!this.model.isPrivate() && this.model.get('left')) {
                toast = new Whisper.LeftGroupToast();
            }

            if (toast) {
                toast.$el.insertAfter(this.$el);
                toast.render();
                this.focusMessageFieldAndClearDisabled();
                return;
            }

            var input = this.$messageField;
            var message = this.replace_colons(input.val()).trim();

            if (message.length > 0 || this.fileInput.hasFiles()) {
                this.fileInput.getFiles().then(function(attachments) {
                    var sendDelta = Date.now() - this.sendStart;
                    console.log('Send pre-checks took', sendDelta, 'milliseconds');
                    this.model.sendMessage(message, attachments);
                    input.val("");
                    this.focusMessageFieldAndClearDisabled();
                    this.forceUpdateMessageFieldSize(e);
                    this.fileInput.deleteFiles();
                }.bind(this)).catch(function() {
                    console.log('Error pulling attached files before send');
                    this.focusMessageFieldAndClearDisabled();
                }.bind(this));
            } else {
                this.focusMessageFieldAndClearDisabled();
            }
        },

        replace_colons: function(str) {
            return str.replace(emoji.rx_colons, function(m) {
                var idx = m.substr(1, m.length-2);
                var val = emoji.map.colons[idx];
                if (val) {
                    return emoji.data[val][0][0];
                } else {
                    return m;
                }
            });
        },

        updateColor: function(model, color) {
            var header = this.$('.conversation-header');
            header.removeClass(Whisper.Conversation.COLORS);
            if (color) {
                header.addClass(color);
            }
            var avatarView = new (Whisper.View.extend({
                templateName: 'avatar',
                render_attributes: { avatar: this.model.getAvatar() }
            }))();
            header.find('.avatar').replaceWith(avatarView.render().$('.avatar'));
        },

        updateAvatar: function(model) {
            var header = this.$('.conversation-header');
            var avatarView = new (Whisper.View.extend({
                templateName: 'avatar',
                render_attributes: { avatar: this.model.getAvatar() }
            }))();
            header.find('.avatar').replaceWith(avatarView.render().$('.avatar'));
        },

        updateMessageFieldSize: function (event) {
            var keyCode = event.which || event.keyCode;

            if (keyCode === 13 && !event.altKey && !event.shiftKey && !event.ctrlKey) {
                // enter pressed - submit the form now
                event.preventDefault();
                return this.$('.bottom-bar form').submit();
            }
            this.toggleMicrophone();
            this.toggleLengthWarning();

            this.view.measureScrollPosition();
            window.autosize(this.$messageField);

            var $attachmentPreviews = this.$('.attachment-previews'),
                $bottomBar = this.$('.bottom-bar');

            $bottomBar.outerHeight(
                    this.$messageField.outerHeight() +
                    $attachmentPreviews.outerHeight() +
                    this.$emojiPanelContainer.outerHeight() +
                    parseInt($bottomBar.css('min-height')));

            this.view.scrollToBottomIfNeeded();
        },

        forceUpdateMessageFieldSize: function (event) {
            if (this.isHidden()) {
                return;
            }
            this.view.scrollToBottomIfNeeded();
            window.autosize.update(this.$messageField);
            this.updateMessageFieldSize(event);
        },

        isHidden: function() {
            return (this.$el.css('display') === 'none') || this.$('.panel').css('display') === 'none';
        }
    });
})();
