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
                name: this.model.getName(),
                number: this.model.getNumber(),
                avatar: this.model.getAvatar(),
                expireTimer: this.model.get('expireTimer'),
                'view-members'    : i18n('members'),
                'end-session'     : i18n('resetSession'),
                'verify-identity' : i18n('verifySafetyNumbers'),
                'destroy'         : i18n('deleteMessages'),
                'send-message'    : i18n('sendMessage'),
                'disappearing-messages': i18n('disappearingMessages'),
                timer_options     : Whisper.ExpirationTimerOptions.models
            };
        },
        initialize: function(options) {
            this.listenTo(this.model, 'destroy', this.stopListening);
            this.listenTo(this.model, 'change:color', this.updateColor);
            this.listenTo(this.model, 'change:name', this.updateTitle);
            this.listenTo(this.model, 'newmessage', this.addMessage);
            this.listenTo(this.model, 'delivered', this.updateMessage);
            this.listenTo(this.model, 'opened', this.onOpened);
            this.listenTo(this.model, 'expired', this.onExpired);
            this.listenTo(this.model.messageCollection, 'expired', this.onExpiredCollection);

            this.render();
            new TimerMenuView({ el: this.$('.timer-menu'), model: this.model });

            emoji_util.parse(this.$('.conversation-name'));

            this.window = options.window;
            this.fileInput = new Whisper.FileInputView({
                el: this.$('form.send'),
                window: this.window
            });

            this.view = new Whisper.MessageListView({
                collection: this.model.messageCollection,
                window: this.window
            });
            this.$('.discussion-container').append(this.view.el);
            this.view.render();

            this.$messageField = this.$('.send-message');

            var onResize = this.forceUpdateMessageFieldSize.bind(this);
            this.window.addEventListener('resize', onResize);

            var onFocus = function() {
                if (this.$el.css('display') !== 'none') {
                    this.markRead();
                }
            }.bind(this);
            this.window.addEventListener('focus', onFocus);

            extension.windows.onClosed(function () {
                this.window.removeEventListener('resize', onResize);
                this.window.removeEventListener('focus', onFocus);
                window.autosize.destroy(this.$messageField);
                this.remove();
                this.model.messageCollection.reset([]);
            }.bind(this));

            this.fetchMessages();

            this.$('.send-message').focus(this.focusBottomBar.bind(this));
            this.$('.send-message').blur(this.unfocusBottomBar.bind(this));
        },

        events: {
            'submit .send': 'sendMessage',
            'input .send-message': 'updateMessageFieldSize',
            'keydown .send-message': 'updateMessageFieldSize',
            'click .destroy': 'destroyMessages',
            'click .end-session': 'endSession',
            'click .leave-group': 'leaveGroup',
            'click .update-group': 'newGroupUpdate',
            'click .verify-identity': 'verifyIdentity',
            'click .view-members': 'viewMembers',
            'click .conversation-menu .hamburger': 'toggleMenu',
            'click .openInbox' : 'openInbox',
            'click' : 'onClick',
            'click .bottom-bar': 'focusMessageField',
            'click .back': 'resetPanel',
            'click .microphone': 'captureAudio',
            'click .disappearing-messages': 'enableDisappearingMessages',
            'focus .send-message': 'focusBottomBar',
            'change .file-input': 'toggleMicrophone',
            'blur .send-message': 'unfocusBottomBar',
            'loadMore .message-list': 'fetchMessages',
            'close .menu': 'closeMenu',
            'select .message-list .entry': 'messageDetail',
            'force-resize': 'forceUpdateMessageFieldSize',
            'verify-identity': 'verifyIdentity'
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
        captureAudio: function(e) {
            e.preventDefault();
            var view = new Whisper.RecorderView().render();
            view.on('send', this.handleAudioCapture.bind(this));
            view.on('closed', this.endCaptureAudio.bind(this));
            view.$el.appendTo(this.$('.capture-audio'));
            this.$('.send-message').attr('disabled','disabled');
            this.$('.microphone').hide();
        },
        handleAudioCapture: function(blob) {
            this.fileInput.file = blob;
            this.fileInput.previewImages();
            this.$('.bottom-bar form').submit();
        },
        endCaptureAudio: function() {
            this.$('.send-message').removeAttr('disabled');
            this.$('.microphone').show();
        },

        unfocusBottomBar: function() {
            this.$('.bottom-bar form').removeClass('active');
        },
        focusBottomBar: function() {
            this.$('.bottom-bar form').addClass('active');
        },

        onOpened: function() {
            this.view.resetScrollPosition();
            this.$el.trigger('force-resize');
            this.focusMessageField();
            this.model.markRead();
        },

        focusMessageField: function() {
            this.$messageField.focus();
        },

        fetchMessages: function() {
            console.log('fetchMessages');
            this.$('.bar-container').show();
            return this.model.fetchContacts().then(function() {
                return this.model.fetchMessages().then(function() {
                    this.$('.bar-container').hide();
                    this.model.messageCollection.where({unread: 1}).forEach(function(m) {
                        m.fetch();
                    });
                }.bind(this));
            }.bind(this));
            // TODO catch?
        },

        onExpired: function(message) {
            var mine = this.model.messageCollection.get(message.id);
            if (mine && mine.cid !== message.cid) {
                mine.trigger('expired', mine);
            }
        },
        onExpiredCollection: function(message) {
            console.log('removing message', message.get('sent_at'), 'from collection');
            this.model.messageCollection.remove(message.id);
        },

        addMessage: function(message) {
            this.model.messageCollection.add(message, {merge: true});
            message.setToExpire();

            if (!this.isHidden() && window.isFocused()) {
                this.markRead();
            }
        },
        updateMessage: function(message) {
            this.model.messageCollection.add(message, {merge: true});
        },

        viewMembers: function() {
            return this.model.fetchContacts().then(function() {
                var view = new Whisper.GroupMemberList({ model: this.model });
                this.listenBack(view);
            }.bind(this));
        },

        openInbox: function() {
            openInbox();
        },

        onClick: function(e) {
            this.closeMenu(e);
            this.markRead(e);
        },

        markRead: function(e) {
            this.model.markRead();
        },

        verifyIdentity: function(ev, model) {
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
                conversation: this.model
            });
            this.listenBack(view);
            view.render();
        },

        listenBack: function(view) {
            this.panel = view;
            this.$('.main.panel, .header-buttons.right').hide();
            this.$('.back').show();
            view.$el.insertBefore(this.$('.panel'));
        },
        resetPanel: function() {
            this.panel.remove();
            this.$('.main.panel, .header-buttons.right').show();
            this.$('.back').hide();
            this.$el.trigger('force-resize');
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

        newGroupUpdate: function() {
            this.newGroupUpdateView = new Whisper.NewGroupUpdateView({
                model: this.model,
                window: this.window
            });
            this.listenBack(this.newGroupUpdateView);
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

        sendMessage: function(e) {
            var toast;
            if (extension.expired()) {
                toast = new Whisper.ExpiredToast();
                toast.$el.insertAfter(this.$el);
                toast.render();
                return;
            }
            if (this.model.isPrivate() && storage.isBlocked(this.model.id)) {
                toast = new Whisper.BlockedToast();
                toast.$el.insertAfter(this.$el);
                toast.render();
                return;
            }
            e.preventDefault();
            var input = this.$messageField;
            var message = this.replace_colons(input.val()).trim();
            var convo = this.model;

            if (message.length > 0 || this.fileInput.hasFiles()) {
                this.fileInput.getFiles().then(function(attachments) {
                    convo.sendMessage(message, attachments);
                });
                input.val("");
                this.forceUpdateMessageFieldSize(e);
                this.fileInput.deleteFiles();
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

        updateTitle: function() {
            this.$('.conversation-title').text(this.model.getTitle());
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

        updateMessageFieldSize: function (event) {
            var keyCode = event.which || event.keyCode;

            if (keyCode === 13 && !event.altKey && !event.shiftKey && !event.ctrlKey) {
                // enter pressed - submit the form now
                event.preventDefault();
                return this.$('.bottom-bar form').submit();
            }
            this.toggleMicrophone();

            this.view.measureScrollPosition();
            window.autosize(this.$messageField);

            var $attachmentPreviews = this.$('.attachment-previews'),
                $bottomBar = this.$('.bottom-bar');

            $bottomBar.outerHeight(
                    this.$messageField.outerHeight() +
                    $attachmentPreviews.outerHeight() +
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
