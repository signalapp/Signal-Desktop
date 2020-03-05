/* global
  $,
  _,
  emojiData,
  EmojiPanel,
  extension,
  i18n,
  Signal,
  storage,
  textsecure,
  Whisper,
  ConversationController,
*/

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};
  const { getAbsoluteAttachmentPath } = window.Signal.Migrations;

  Whisper.OriginalNotFoundToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('originalMessageNotFound') };
    },
  });
  Whisper.OriginalNoLongerAvailableToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('originalMessageNotAvailable') };
    },
  });
  Whisper.FoundButNotLoadedToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('messageFoundButNotLoaded') };
    },
  });
  Whisper.VoiceNoteMustBeOnlyAttachmentToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('voiceNoteMustBeOnlyAttachment') };
    },
  });

  Whisper.ConversationView = Whisper.View.extend({
    className() {
      return ['conversation', this.model.get('type')].join(' ');
    },
    id() {
      return `conversation-${this.model.cid}`;
    },
    template: $('#conversation').html(),
    render_attributes() {
      return {
        'disable-inputs': false,
        'send-message': i18n('sendMessage'),
      };
    },
    initialize(options) {
      this.listenTo(this.model, 'destroy', this.stopListening);
      this.listenTo(this.model, 'change:verified', this.onVerifiedChange);
      this.listenTo(
        this.model,
        'change:friendRequestStatus',
        this.onFriendStatusChange
      );
      this.listenTo(this.model, 'newmessage', this.addMessage);
      this.listenTo(this.model, 'opened', this.onOpened);
      this.listenTo(this.model, 'prune', this.onPrune);
      this.listenTo(this.model, 'disable:input', this.onDisableInput);
      this.listenTo(this.model, 'change:placeholder', this.onChangePlaceholder);
      this.listenTo(this.model, 'unload', () => this.unload('model trigger'));
      this.listenTo(this.model, 'typing-update', this.renderTypingBubble);
      this.listenTo(
        this.model.messageCollection,
        'show-identity',
        this.showSafetyNumber
      );
      this.listenTo(this.model.messageCollection, 'force-send', this.forceSend);
      this.listenTo(this.model.messageCollection, 'delete', this.deleteMessage);
      this.listenTo(
        this.model.messageCollection,
        'scroll-to-message',
        this.scrollToMessage
      );
      this.listenTo(
        this.model.messageCollection,
        'reply',
        this.setQuoteMessage
      );
      this.listenTo(
        this.model.messageCollection,
        'show-contact-detail',
        this.showContactDetail
      );
      this.listenTo(
        this.model.messageCollection,
        'show-lightbox',
        this.showLightbox
      );
      this.listenTo(
        this.model.messageCollection,
        'download',
        this.downloadAttachment
      );
      this.listenTo(
        this.model.messageCollection,
        'open-conversation',
        this.openConversation
      );
      this.listenTo(
        this.model.messageCollection,
        'show-message-detail',
        this.showMessageDetail
      );
      this.listenTo(this.model.messageCollection, 'navigate-to', url => {
        window.location = url;
      });

      this.lazyUpdateVerified = _.debounce(
        this.model.updateVerified.bind(this.model),
        1000 // one second
      );
      this.throttledGetProfiles = _.throttle(
        this.model.getProfiles.bind(this.model),
        1000 * 60 * 5 // five minutes
      );
      this.debouncedMaybeGrabLinkPreview = _.debounce(
        this.maybeGrabLinkPreview.bind(this),
        200
      );

      this.render();
      this.onFriendStatusChange();

      this.model.updateTextInputState();

      this.loadingScreen = new Whisper.ConversationLoadingScreen();
      this.loadingScreen.render();
      this.loadingScreen.$el.prependTo(this.$('.discussion-container'));

      this.window = options.window;
      this.fileInput = new Whisper.FileInputView({
        el: this.$('.attachment-list'),
      });
      this.listenTo(
        this.fileInput,
        'choose-attachment',
        this.onChooseAttachment
      );
      this.listenTo(this.fileInput, 'staged-attachments-changed', () => {
        this.view.restoreBottomOffset();
        this.toggleMicrophone();
        if (this.fileInput.hasFiles()) {
          this.removeLinkPreview();
        }
      });
      Whisper.events.on('mediaPermissionsChanged', () =>
        this.toggleMicrophone()
      );

      const getHeaderProps = () => {
        const expireTimer = this.model.get('expireTimer');
        const expirationSettingName = expireTimer
          ? Whisper.ExpirationTimerOptions.getName(expireTimer || 0)
          : null;

        const members = this.model.get('members') || [];

        return {
          id: this.model.id,
          name: this.model.getName(),
          phoneNumber: this.model.getNumber(),
          profileName: this.model.getProfileName(),
          color: this.model.getColor(),
          avatarPath: this.model.getAvatarPath(),
          isVerified: this.model.isVerified(),
          isFriendRequestPending: this.model.isPendingFriendRequest(),
          isFriend: this.model.isFriend(),
          isMe: this.model.isMe(),
          isClosable: this.model.isClosable(),
          isBlocked: this.model.isBlocked(),
          isGroup: !this.model.isPrivate(),
          isOnline: this.model.isOnline(),
          isArchived: this.model.get('isArchived'),
          isPublic: this.model.isPublic(),
          isRss: this.model.isRss(),
          amMod: this.model.isModerator(
            window.storage.get('primaryDevicePubKey')
          ),
          members,
          subscriberCount: this.model.get('subscriberCount'),
          selectedMessages: this.model.selectedMessages,
          expirationSettingName,
          showBackButton: Boolean(this.panels && this.panels.length),
          timerOptions: Whisper.ExpirationTimerOptions.map(item => ({
            name: item.getName(),
            value: item.get('seconds'),
          })),
          hasNickname: !!this.model.getNickname(),

          onSetDisappearingMessages: seconds =>
            this.setDisappearingMessages(seconds),
          onDeleteMessages: () => this.destroyMessages(),
          onDeleteSelectedMessages: () => this.deleteSelectedMessages(),
          onCloseOverlay: () => this.model.resetMessageSelection(),
          onDeleteContact: () => this.model.deleteContact(),
          onResetSession: () => this.endSession(),

          // These are view only and don't update the Conversation model, so they
          //   need a manual update call.
          onShowSafetyNumber: () => {
            this.showSafetyNumber();
          },
          onShowAllMedia: async () => {
            this.updateHeader();
          },
          onShowGroupMembers: async () => {
            await this.showMembers();
            this.updateHeader();
          },
          onGoBack: () => {
            this.resetPanel();
            this.updateHeader();
          },

          onBlockUser: () => {
            this.model.block();
          },
          onUnblockUser: () => {
            this.model.unblock();
          },
          onChangeNickname: () => {
            this.model.changeNickname();
          },
          onClearNickname: () => {
            this.model.setNickname(null);
          },
          onCopyPublicKey: () => {
            this.model.copyPublicKey();
          },
          onArchive: () => {
            this.unload('archive');
            this.model.setArchived(true);
          },
          onMoveToInbox: () => {
            this.model.setArchived(false);
          },
          onLeaveGroup: () => {
            window.Whisper.events.trigger('leaveGroup', this.model);
          },

          onInviteFriends: () => {
            window.Whisper.events.trigger('inviteFriends', this.model);
          },

          onUpdateGroupName: () => {
            window.Whisper.events.trigger('updateGroupName', this.model);
          },

          onAddModerators: () => {
            window.Whisper.events.trigger('addModerators', this.model);
          },

          onRemoveModerators: () => {
            window.Whisper.events.trigger('removeModerators', this.model);
          },

          onAvatarClick: pubkey => {
            if (this.model.isPrivate()) {
              window.Whisper.events.trigger('onShowUserDetails', {
                userPubKey: pubkey,
              });
            } else if (!this.model.isRss()) {
              this.showGroupSettings();
            }
          },
        };
      };
      const getGroupSettingsProps = () => {
        const ourPK = window.textsecure.storage.user.getNumber();
        const members = this.model.get('members') || [];

        return {
          id: this.model.id,
          name: this.model.getName(),
          phoneNumber: this.model.getNumber(),
          profileName: this.model.getProfileName(),
          color: this.model.getColor(),
          avatarPath: this.model.getAvatarPath(),
          isGroup: !this.model.isPrivate(),
          isPublic: this.model.isPublic(),
          isAdmin: this.model.get('groupAdmins').includes(ourPK),
          isRss: this.model.isRss(),
          memberCount: members.length,
          amMod: this.model.isModerator(
            window.storage.get('primaryDevicePubKey')
          ),

          timerOptions: Whisper.ExpirationTimerOptions.map(item => ({
            name: item.getName(),
            value: item.get('seconds'),
          })),

          onSetDisappearingMessages: seconds =>
            this.setDisappearingMessages(seconds),

          onGoBack: () => {
            this.hideConversationRight();
          },

          onUpdateGroupName: () => {
            window.Whisper.events.trigger('updateGroupName', this.model);
          },
          onUpdateGroupMembers: () => {
            window.Whisper.events.trigger('updateGroupMembers', this.model);
          },

          onLeaveGroup: () => {
            window.Whisper.events.trigger('leaveGroup', this.model);
          },

          onInviteFriends: () => {
            window.Whisper.events.trigger('inviteFriends', this.model);
          },
          onShowLightBox: (lightBoxOptions = {}) => {
            this.showChannelLightbox(lightBoxOptions);
          },
        };
      };
      this.titleView = new Whisper.ReactWrapperView({
        className: 'title-wrapper',
        Component: window.Signal.Components.ConversationHeader,
        props: getHeaderProps(),
      });
      this.updateHeader = () => this.titleView.update(getHeaderProps());
      this.listenTo(this.model, 'change', this.updateHeader);
      this.$('.conversation-header').append(this.titleView.el);

      this.view = new Whisper.MessageListView({
        collection: this.model.messageCollection,
        window: this.window,
      });
      this.$('.discussion-container').append(this.view.el);
      this.view.render();

      this.memberView = new Whisper.MemberListView({
        el: this.$('.member-list-container'),
        onClicked: this.selectMember.bind(this),
      });

      this.hideConversationRight = () => {
        this.$('.conversation-content-right').css({
          'margin-right': '-22vw',
        });
      };
      this.showConversationRight = () => {
        this.$('.conversation-content-right').css({
          'margin-right': '0vw',
        });
      };

      this.showGroupSettings = () => {
        if (!this.groupSettings) {
          this.groupSettings = new Whisper.ReactWrapperView({
            className: 'group-settings',
            Component: window.Signal.Components.SessionGroupSettings,
            props: getGroupSettingsProps(this.model),
          });
          this.$('.conversation-content-right').append(this.groupSettings.el);
          this.updateGroupSettingsPanel = () =>
            this.groupSettings.update(getGroupSettingsProps(this.model));
          this.listenTo(this.model, 'change', this.updateGroupSettingsPanel);
        } else {
          this.groupSettings.update(getGroupSettingsProps(this.model));
        }

        this.showConversationRight();
      };

      this.hideGroupSettings = () => {
        this.showConversationRight();
      };

      this.memberView.render();

      this.bulkEditView = new Whisper.BulkEditView({
        el: this.$('#bulk-edit-view'),
        onCancel: this.resetMessageSelection.bind(this),
        onDelete: this.deleteSelectedMessages.bind(this),
      });

      this.$messageField = this.$('.send-message');

      this.onResize = this.forceUpdateMessageFieldSize.bind(this);
      this.window.addEventListener('resize', this.onResize);

      this.onFocus = () => {
        if (this.$el.css('display') !== 'none') {
          this.markRead();
        }
      };
      this.window.addEventListener('focus', this.onFocus);

      extension.windows.onClosed(() => {
        this.unload('windows closed');
      });

      this.fetchMessages();

      this.$('.send-message').focus(this.focusBottomBar.bind(this));
      this.$('.send-message').blur(this.unfocusBottomBar.bind(this));

      this.$emojiPanelContainer = this.$('.emoji-panel-container');
      this.model.updateTextInputState();

      this.selectMember = this.selectMember.bind(this);

      const updateMemberList = async () => {
        const allPubKeys = await window.Signal.Data.getPubkeysInPublicConversation(
          this.model.id
        );

        const allMembers = await Promise.all(
          allPubKeys.map(async pubKey => {
            const conv = ConversationController.get(pubKey);
            let profileName = 'Anonymous';
            if (conv) {
              profileName = await conv.getProfileName();
            }
            return {
              id: pubKey,
              authorPhoneNumber: pubKey,
              authorProfileName: profileName,
            };
          })
        );
        window.lokiPublicChatAPI.setListOfMembers(allMembers);
      };

      if (this.model.isPublic()) {
        updateMemberList();
        setInterval(updateMemberList, 10000);
      }
    },

    events: {
      keydown: 'onKeyDown',
      'submit .send': 'handleSubmitPressed',
      'input .send-message': 'handleInputEvent',
      'keydown .send-message': 'handleInputEvent',
      'keyup .send-message': 'onKeyUp',
      click: 'onClick',
      'click .bottom-bar': 'focusMessageField',
      'click .capture-audio .microphone': 'captureAudio',
      'click .module-scroll-down': 'scrollToBottom',
      'click button.emoji': 'toggleEmojiPanel',
      'focus .send-message': 'focusBottomBar',
      'change .file-input': 'toggleMicrophone',
      'blur .send-message': 'unfocusBottomBar',
      'loadMore .message-list': 'loadMoreMessages',
      'newOffscreenMessage .message-list': 'addScrollDownButtonWithCount',
      'atBottom .message-list': 'removeScrollDownButton',
      'farFromBottom .message-list': 'addScrollDownButton',
      'lazyScroll .message-list': 'onLazyScroll',
      'force-resize': 'forceUpdateMessageFieldSize',

      'click button.paperclip': 'onChooseAttachment',
      'change input.file-input': 'onChoseAttachment',

      dragover: 'onDragOver',
      dragleave: 'onDragLeave',
      // TODO(Loki): restore when we support attachments
      // drop: 'onDrop',
      // paste: 'onPaste',
    },

    onChooseAttachment(e) {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }

      this.$('input.file-input').click();
    },
    async onChoseAttachment() {
      const fileField = this.$('input.file-input');
      const files = fileField.prop('files');

      for (let i = 0, max = files.length; i < max; i += 1) {
        const file = files[i];
        // eslint-disable-next-line no-await-in-loop
        await this.fileInput.maybeAddAttachment(file);
        this.toggleMicrophone();
      }

      fileField.val(null);
    },

    onDragOver(e) {
      this.fileInput.onDragOver(e);
    },
    onDragLeave(e) {
      this.fileInput.onDragLeave(e);
    },
    onDrop(e) {
      this.fileInput.onDrop(e);
    },
    onPaste(e) {
      this.fileInput.onPaste(e);
    },

    onPrune() {
      if (!this.model.messageCollection.length || !this.lastActivity) {
        return;
      }

      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      if (this.isHidden() && this.lastActivity < oneHourAgo) {
        this.unload('inactivity');
      } else if (this.view.atBottom()) {
        this.trim();
      }
    },

    onDisableInput(disable) {
      this.$(
        'button.emoji, button.microphone, button.paperclip, .send-message'
      ).attr('disabled', disable);
    },

    onChangePlaceholder(type) {
      if (!this.$messageField) {
        return;
      }
      let placeholder;
      switch (type) {
        case 'friend-request':
          placeholder = i18n('sendMessageFriendRequest');
          break;
        case 'disabled':
          placeholder = i18n('sendMessageDisabled');
          break;
        case 'secondary':
          placeholder = i18n('sendMessageDisabledSecondary');
          break;
        case 'left-group':
          placeholder = i18n('sendMessageLeftGroup');
          break;
        default:
          placeholder = i18n('sendMessage');
          break;
      }
      this.$messageField.attr('placeholder', placeholder);
    },

    unload(reason) {
      window.log.info(
        'unloading conversation',
        this.model.idForLogging(),
        'due to:',
        reason
      );

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
      if (this.quoteView) {
        this.quoteView.remove();
      }
      if (this.lightBoxView) {
        this.lightBoxView.remove();
      }
      if (this.lightboxGalleryView) {
        this.lightboxGalleryView.remove();
      }
      if (this.panels && this.panels.length) {
        for (let i = 0, max = this.panels.length; i < max; i += 1) {
          const panel = this.panels[i];
          panel.remove();
        }
      }

      this.window.removeEventListener('resize', this.onResize);
      this.window.removeEventListener('focus', this.onFocus);

      window.autosize.destroy(this.$messageField);

      this.view.remove();

      this.remove();

      this.model.messageCollection.forEach(model => {
        model.trigger('unload');
      });
      this.model.messageCollection.reset([]);
    },

    trim() {
      const MAX = 100;
      const toRemove = this.model.messageCollection.length - MAX;
      if (toRemove <= 0) {
        return;
      }

      const models = [];
      for (let i = 0; i < toRemove; i += 1) {
        const model = this.model.messageCollection.at(i);
        models.push(model);
      }

      if (!models.length) {
        return;
      }

      window.log.info(
        'trimming conversation',
        this.model.idForLogging(),
        'of',
        models.length,
        'old messages'
      );

      this.model.messageCollection.remove(models);
      _.forEach(models, model => {
        model.trigger('unload');
      });
    },

    markAllAsVerifiedDefault(unverified) {
      return Promise.all(
        unverified.map(contact => {
          if (contact.isUnverified()) {
            return contact.setVerifiedDefault();
          }

          return null;
        })
      );
    },

    markAllAsApproved(untrusted) {
      return Promise.all(untrusted.map(contact => contact.setApproved()));
    },

    openSafetyNumberScreens(unverified) {
      if (unverified.length === 1) {
        this.showSafetyNumber(unverified.at(0));
        return;
      }

      this.showMembers(null, unverified, { needVerify: true });
    },

    onVerifiedChange() {
      if (this.model.isUnverified()) {
        const unverified = this.model.getUnverified();
        let message;
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
          message,
          onDismiss: () => {
            this.markAllAsVerifiedDefault(unverified);
          },
          onClick: () => {
            this.openSafetyNumberScreens(unverified);
          },
        });

        const container = this.$('.discussion-container');
        container.append(this.banner.el);
      } else if (this.banner) {
        this.banner.remove();
        this.banner = null;
      }
    },

    renderTypingBubble() {
      const timers = this.model.contactTypingTimers || {};
      const records = _.values(timers);
      const mostRecent = _.first(_.sortBy(records, 'timestamp'));

      if (!mostRecent && this.typingBubbleView) {
        this.typingBubbleView.remove();
        this.typingBubbleView = null;
      }
      if (!mostRecent) {
        return;
      }

      const { sender } = mostRecent;
      const contact = ConversationController.getOrCreate(sender, 'private');
      const props = {
        ...contact.format(),
        conversationType: this.model.isPrivate() ? 'direct' : 'group',
      };

      if (this.typingBubbleView) {
        this.typingBubbleView.update(props);
        return;
      }

      this.typingBubbleView = new Whisper.ReactWrapperView({
        className: 'message-wrapper typing-bubble-wrapper',
        Component: Signal.Components.TypingBubble,
        props,
      });
      this.typingBubbleView.$el.appendTo(this.$('.typing-container'));

      if (this.view.atBottom()) {
        this.typingBubbleView.el.scrollIntoView();
      }
    },

    onFriendStatusChange() {
      if (this.model.isPrivate() && !this.model.isFriend()) {
        this.$('#choose-file').hide();
      } else {
        this.$('#choose-file').show();
      }
    },

    async toggleMicrophone() {
      const allowMicrophone = await window.getMediaPermissions();
      if (
        !allowMicrophone ||
        this.$('.send-message').val().length > 0 ||
        this.fileInput.hasFiles()
      ) {
        this.$('.capture-audio').hide();
      } else {
        this.$('.capture-audio').show();
      }
    },
    captureAudio(e) {
      e.preventDefault();

      if (this.fileInput.hasFiles()) {
        const toast = new Whisper.VoiceNoteMustBeOnlyAttachmentToast();
        toast.$el.appendTo(this.$el);
        toast.render();
        return;
      }

      // Note - clicking anywhere will close the audio capture panel, due to
      //   the onClick handler in InboxView, which calls its closeRecording method.

      if (this.captureAudioView) {
        this.captureAudioView.remove();
        this.captureAudioView = null;
      }

      this.captureAudioView = new Whisper.RecorderView();

      const view = this.captureAudioView;
      view.render();
      view.on('send', this.handleAudioCapture.bind(this));
      view.on('closed', this.endCaptureAudio.bind(this));
      view.$el.appendTo(this.$('.capture-audio'));

      this.$('.send-message').attr('disabled', true);
      this.$('.microphone').hide();
    },
    handleAudioCapture(blob) {
      this.fileInput.addAttachment({
        contentType: blob.type,
        file: blob,
        isVoiceNote: true,
      });
      this.$('.bottom-bar form').submit();
    },
    endCaptureAudio() {
      this.$('.send-message').removeAttr('disabled');
      this.$('.microphone').show();
      this.captureAudioView = null;
    },

    unfocusBottomBar() {
      this.$('.bottom-bar form').removeClass('active');
    },
    focusBottomBar() {
      this.$('.bottom-bar form').addClass('active');
    },

    onLazyScroll() {
      // The in-progress fetch check is important, because while that happens, lots
      //   of messages are added to the DOM, one by one, changing window size and
      //   generating scroll events.
      if (!this.isHidden() && window.isFocused() && !this.inProgressFetch) {
        this.lastActivity = Date.now();
        this.markRead();
      }
    },
    updateUnread() {
      this.resetLastSeenIndicator();
      // Waiting for scrolling caused by resetLastSeenIndicator to settle down
      setTimeout(this.markRead.bind(this), 1);
    },

    onLoaded() {
      const view = this.loadingScreen;
      if (view) {
        const openDelta = Date.now() - this.openStart;
        window.log.info(
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

    onOpened() {
      this.openStart = Date.now();
      this.lastActivity = Date.now();

      this.model.updateLastMessage();
      this.model.resetMessageSelection();

      if (this.model.isRss()) {
        $('.compose').hide();
        $('.conversation-stack').removeClass('conversation-stack-no-border');
        $('.conversation-stack').addClass('conversation-stack-border');
      } else {
        $('.compose').show();
        $('.conversation-stack').removeClass('conversation-stack-border');
        $('.conversation-stack').addClass('conversation-stack-no-border');
      }

      // const statusPromise = this.throttledGetProfiles();
      // // eslint-disable-next-line more/no-then
      // this.statusFetch = statusPromise.then(() =>
      //   // eslint-disable-next-line more/no-then
      //   this.model.updateVerified().then(() => {
      //     this.onVerifiedChange();
      //     this.statusFetch = null;
      //     window.log.info('done with status fetch');
      //   })
      // );

      // We schedule our catch-up decrypt right after any in-progress fetch of
      //   messages from the database, then ensure that the loading screen is only
      //   dismissed when that is complete.
      const messagesLoaded = this.inProgressFetch || Promise.resolve();

      // eslint-disable-next-line more/no-then
      messagesLoaded.then(this.onLoaded.bind(this), this.onLoaded.bind(this));

      this.view.resetScrollPosition();
      this.$el.trigger('force-resize');
      this.focusMessageField();
      this.renderTypingBubble();

      if (this.inProgressFetch) {
        // eslint-disable-next-line more/no-then
        this.inProgressFetch.then(this.updateUnread.bind(this));
      } else {
        this.updateUnread();
      }
    },

    addScrollDownButtonWithCount() {
      this.updateScrollDownButton(1);
    },

    addScrollDownButton() {
      if (!this.scrollDownButton) {
        this.updateScrollDownButton();
      }
    },

    updateScrollDownButton(count) {
      if (!this.scrollDownButton) {
        this.scrollDownButton = new Whisper.ScrollDownButtonView({ count });
        this.scrollDownButton.render();
        const container = this.$('.discussion-container');
        container.append(this.scrollDownButton.el);
      }
    },

    removeScrollDownButton() {
      if (this.scrollDownButton) {
        const button = this.scrollDownButton;
        this.scrollDownButton = null;
        button.remove();
      }
    },

    removeLastSeenIndicator() {
      if (this.lastSeenIndicator) {
        const indicator = this.lastSeenIndicator;
        this.lastSeenIndicator = null;
        indicator.remove();
      }
    },

    async scrollToMessage(options = {}) {
      const { author, id, referencedMessageNotFound } = options;

      // For simplicity's sake, we show the 'not found' toast no matter what if we were
      //   not able to find the referenced message when the quote was received.
      if (referencedMessageNotFound) {
        const toast = new Whisper.OriginalNotFoundToast();
        toast.$el.appendTo(this.$el);
        toast.render();
        return;
      }

      // Look for message in memory first, which would tell us if we could scroll to it
      const targetMessage = this.model.messageCollection.find(item => {
        const messageAuthor = item.getContact();

        if (!messageAuthor || author !== messageAuthor.id) {
          return false;
        }
        if (id !== item.get('sent_at')) {
          return false;
        }

        return true;
      });

      // If there's no message already in memory, we won't be scrolling. So we'll gather
      //   some more information then show an informative toast to the user.
      if (!targetMessage) {
        const collection = await window.Signal.Data.getMessagesBySentAt(id, {
          MessageCollection: Whisper.MessageCollection,
        });
        const found = Boolean(
          collection.find(item => {
            const messageAuthor = item.getContact();

            return messageAuthor && author === messageAuthor.id;
          })
        );

        if (found) {
          const toast = new Whisper.FoundButNotLoadedToast();
          toast.$el.appendTo(this.$el);
          toast.render();
        } else {
          const toast = new Whisper.OriginalNoLongerAvailableToast();
          toast.$el.appendTo(this.$el);
          toast.render();
        }
        return;
      }

      const databaseId = targetMessage.id;
      const el = this.$(`#${databaseId}`);
      if (!el || el.length === 0) {
        const toast = new Whisper.OriginalNoLongerAvailableToast();
        toast.$el.appendTo(this.$el);
        toast.render();

        window.log.info(
          `Error: had target message ${id} in messageCollection, but it was not in DOM`
        );
        return;
      }

      el[0].scrollIntoView();
    },

    scrollToBottom() {
      // If we're above the last seen indicator, we should scroll there instead
      // Note: if we don't end up at the bottom of the conversation, button won't go away!
      if (this.lastSeenIndicator) {
        const location = this.lastSeenIndicator.$el.position().top;
        if (location > 0) {
          this.lastSeenIndicator.el.scrollIntoView();
          return;
        }
        this.removeLastSeenIndicator();
      }
      this.view.scrollToBottom();
    },

    resetLastSeenIndicator(options = {}) {
      _.defaults(options, { scroll: true });

      let unreadCount = 0;
      let oldestUnread = null;

      // We need to iterate here because unseen non-messages do not contribute to
      //   the badge number, but should be reflected in the indicator's count.
      this.model.messageCollection.forEach(model => {
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
        this.lastSeenIndicator = new Whisper.LastSeenIndicatorView({
          count: unreadCount,
        });
        const lastSeenEl = this.lastSeenIndicator.render().$el;

        lastSeenEl.insertBefore(this.$(`#${oldestUnread.get('id')}`));

        if (this.view.atBottom() || options.scroll) {
          lastSeenEl[0].scrollIntoView();
        }

        // scrollIntoView is an async operation, but we have no way to listen for
        //   completion of the resultant scroll.
        setTimeout(() => {
          if (!this.view.atBottom()) {
            this.addScrollDownButtonWithCount(unreadCount);
          }
        }, 1);
      } else if (this.view.atBottom()) {
        // If we already thought we were at the bottom, then ensure that's the case.
        //   Attempting to account for unpredictable completion of message rendering.
        setTimeout(() => this.view.scrollToBottom(), 1);
      }
    },

    focusMessageField() {
      if (this.panels && this.panels.length) {
        return;
      }

      this.$messageField.focus();
    },

    focusMessageFieldAndClearDisabled() {
      this.$messageField.removeAttr('disabled');
      this.$messageField.focus();
    },

    async loadMoreMessages() {
      if (this.inProgressFetch) {
        return;
      }

      this.view.measureScrollPosition();
      const startingHeight = this.view.scrollHeight;

      await this.fetchMessages();
      // We delay this work to let scrolling/layout settle down first
      setTimeout(() => {
        this.view.measureScrollPosition();
        const endingHeight = this.view.scrollHeight;
        const delta = endingHeight - startingHeight;
        const height = this.view.outerHeight;

        const newScrollPosition = this.view.scrollPosition + delta - height;
        this.view.$el.scrollTop(newScrollPosition);
      }, 1);
    },
    fetchMessages() {
      window.log.info('fetchMessages');
      this.$('.bar-container').show();
      if (this.inProgressFetch) {
        window.log.warn('Multiple fetchMessage calls!');
      }

      // Avoiding await, since we want to capture the promise and make it available via
      //   this.inProgressFetch
      // eslint-disable-next-line more/no-then
      this.inProgressFetch = this.model
        .fetchContacts()
        .then(() => this.model.fetchMessages())
        .then(async () => {
          this.$('.bar-container').hide();
          await Promise.all(
            this.model.messageCollection.where({ unread: 1 }).map(async m => {
              const latest = await window.Signal.Data.getMessageById(m.id, {
                Message: Whisper.Message,
              });
              m.merge(latest);
            })
          );
          this.inProgressFetch = null;
        })
        .catch(error => {
          window.log.error(
            'fetchMessages error:',
            error && error.stack ? error.stack : error
          );
          this.inProgressFetch = null;
        });

      return this.inProgressFetch;
    },

    addMessage(message) {
      // This is debounced, so it won't hit the database too often.
      this.lazyUpdateVerified();

      // We do this here because we don't want convo.messageCollection to have
      //   anything in it unless it has an associated view. This is so, when we
      //   fetch on open, it's clean.
      this.model.addSingleMessage(message);

      if (message.isOutgoing()) {
        this.removeLastSeenIndicator();
      }
      if (this.lastSeenIndicator) {
        this.lastSeenIndicator.increment(1);
      }

      if (!this.isHidden() && !window.isFocused()) {
        // The conversation is visible, but window is not focused
        if (!this.lastSeenIndicator) {
          this.resetLastSeenIndicator({ scroll: false });
        } else if (
          this.view.atBottom() &&
          this.model.get('unreadCount') === this.lastSeenIndicator.getCount()
        ) {
          // The count check ensures that the last seen indicator is still in
          //   sync with the real number of unread, so we can scroll to it.
          //   We only do this if we're at the bottom, because that signals that
          //   the user is okay with us changing scroll around so they see the
          //   right unseen message first.
          this.resetLastSeenIndicator({ scroll: true });
        }
      } else if (!this.isHidden() && window.isFocused()) {
        // The conversation is visible and in focus
        this.markRead();

        // When we're scrolled up and we don't already have a last seen indicator
        //   we add a new one.
        if (!this.view.atBottom() && !this.lastSeenIndicator) {
          this.resetLastSeenIndicator({ scroll: false });
        }
      }
    },

    onClick() {
      // If there are sub-panels open, we don't want to respond to clicks
      if (!this.panels || !this.panels.length) {
        this.markRead();
      }
    },

    findNewestVisibleUnread() {
      const collection = this.model.messageCollection;
      const { length } = collection;
      const viewportBottom = this.view.outerHeight;
      const unreadCount = this.model.get('unreadCount') || 0;

      // Start with the most recent message, search backwards in time
      let foundUnread = 0;
      for (let i = length - 1; i >= 0; i -= 1) {
        // Search the latest 30, then stop if we believe we've covered all known
        //   unread messages. The unread should be relatively recent.
        // Why? local notifications can be unread but won't be reflected the
        //   conversation's unread count.
        if (i > 30 && foundUnread >= unreadCount) {
          return null;
        }

        const message = collection.at(i);
        if (!message.get('unread')) {
          // eslint-disable-next-line no-continue
          continue;
        }

        foundUnread += 1;

        const el = this.$(`#${message.id}`);
        const position = el.position();
        // This message is likely not loaded yet in the DOM
        if (!position) {
          // should this be break?

          // eslint-disable-next-line no-continue
          continue;
        }
        const { top } = position;

        // We're fully below the viewport, continue searching up.
        if (top > viewportBottom) {
          // eslint-disable-next-line no-continue
          continue;
        }

        // If the bottom fits on screen, we'll call it visible. Even if the
        //   message is really tall.
        const height = el.height();
        const bottom = top + height;
        if (bottom <= viewportBottom) {
          return message;
        }

        // Continue searching up.
      }

      return null;
    },

    markRead() {
      let unread;

      if (this.view.atBottom()) {
        unread = this.model.messageCollection.last();
      } else {
        unread = this.findNewestVisibleUnread();
      }

      if (unread) {
        this.model.markRead(unread.get('received_at'));
      }
    },

    async showMembers(e, providedMembers, options = {}) {
      _.defaults(options, { needVerify: false });

      const model = providedMembers || this.model.contactCollection;
      const view = new Whisper.GroupMemberList({
        model,
        // we pass this in to allow nested panels
        listenBack: this.listenBack.bind(this),
        needVerify: options.needVerify,
      });

      this.listenBack(view);
    },

    forceSend({ contact, message }) {
      window.confirmationDialog({
        message: i18n('identityKeyErrorOnSend', [
          contact.getTitle(),
          contact.getTitle(),
        ]),
        okText: i18n('sendAnyway'),
        resolve: async () => {
          await contact.updateVerified();

          if (contact.isUnverified()) {
            await contact.setVerifiedDefault();
          }

          const untrusted = await contact.isUntrusted();
          if (untrusted) {
            await contact.setApproved();
          }

          message.resend(contact.id);
        },
      });
    },

    showSafetyNumber(providedModel) {
      let model = providedModel;

      if (!model && this.model.isPrivate()) {
        // eslint-disable-next-line prefer-destructuring
        model = this.model;
      }
      if (model) {
        const view = new Whisper.KeyVerificationPanelView({
          model,
        });
        this.listenBack(view);
        this.updateHeader();
      }
    },

    downloadAttachment({ attachment, message, isDangerous }) {
      if (isDangerous) {
        const toast = new Whisper.DangerousFileTypeToast();
        toast.$el.appendTo(this.$el);
        toast.render();
        return;
      }
      Signal.Types.Attachment.save({
        attachment,
        document,
        getAbsolutePath: getAbsoluteAttachmentPath,
        timestamp: message.get ? message.get('sent_at') : message.sent_at,
      });
    },

    deleteSelectedMessages() {
      const ourPubkey = textsecure.storage.user.getNumber();
      const selected = Array.from(this.model.selectedMessages);
      const isModerator = this.model.isModerator(ourPubkey);
      const isAllOurs = selected.every(
        message => message.attributes.source === message.OUR_NUMBER
      );

      if (!isAllOurs && !isModerator) {
        window.pushToast({
          title: i18n('messageDeletionForbidden'),
          type: 'error',
          id: 'messageDeletionForbidden',
        });

        return;
      }

      this.deleteMessages(selected, () => {
        this.resetMessageSelection();
      });
    },

    deleteMessages(messages, onSuccess) {
      const multiple = messages.length > 1;

      const warningMessage = (() => {
        if (this.model.isPublic()) {
          return multiple
            ? i18n('deleteMultiplePublicWarning')
            : i18n('deletePublicWarning');
        }
        return multiple ? i18n('deleteMultipleWarning') : i18n('deleteWarning');
      })();

      const doDelete = async () => {
        let toDeleteLocally;

        if (this.model.isPublic()) {
          toDeleteLocally = await this.model.deletePublicMessages(messages);
          if (toDeleteLocally.length === 0) {
            // Message failed to delete from server, show error?
            return;
          }
        } else {
          messages.forEach(m => this.model.messageCollection.remove(m.id));
          toDeleteLocally = messages;
        }

        await Promise.all(
          toDeleteLocally.map(async m => {
            await window.Signal.Data.removeMessage(m.id, {
              Message: Whisper.Message,
            });
            m.trigger('unload');
          })
        );

        this.resetPanel();
        this.updateHeader();

        if (onSuccess) {
          onSuccess();
        }
      };

      // Only show a warning when at least one messages was successfully
      // saved in on the server
      if (!messages.some(m => !m.hasErrors())) {
        doDelete();
        return;
      }

      window.confirmationDialog({
        message: warningMessage,
        okText: i18n('delete'),
        resolve: doDelete,
      });
    },

    deleteMessage(message) {
      this.deleteMessages([message]);
    },

    showChannelLightbox({ media, attachment, message }) {
      const selectedIndex = media.findIndex(
        mediaMessage => mediaMessage.attachment.path === attachment.path
      );
      this.lightboxGalleryView = new Whisper.ReactWrapperView({
        className: 'lightbox-wrapper',
        Component: Signal.Components.LightboxGallery,
        props: {
          media,
          onSave: () => this.downloadAttachment({ attachment, message }),
          selectedIndex,
        },
        onClose: () => Signal.Backbone.Views.Lightbox.hide(),
      });
      Signal.Backbone.Views.Lightbox.show(this.lightboxGalleryView.el);
    },

    showLightbox({ attachment, message }) {
      const { contentType, path } = attachment;

      if (
        !Signal.Util.GoogleChrome.isImageTypeSupported(contentType) &&
        !Signal.Util.GoogleChrome.isVideoTypeSupported(contentType)
      ) {
        this.downloadAttachment({ attachment, message });
        return;
      }

      const attachments = message.get('attachments') || [];

      const media = attachments
        .filter(item => item.thumbnail && !item.pending && !item.error)
        .map((item, index) => ({
          objectURL: getAbsoluteAttachmentPath(item.path),
          path: item.path,
          contentType: item.contentType,
          index,
          message,
          attachment: item,
        }));

      if (media.length === 1) {
        const props = {
          objectURL: getAbsoluteAttachmentPath(path),
          contentType,
          caption: attachment.caption,
          onSave: () => this.downloadAttachment({ attachment, message }),
        };
        this.lightboxView = new Whisper.ReactWrapperView({
          className: 'lightbox-wrapper',
          Component: Signal.Components.Lightbox,
          props,
          onClose: () => {
            Signal.Backbone.Views.Lightbox.hide();
            this.stopListening(message);
          },
        });
        this.listenTo(message, 'expired', () => this.lightboxView.remove());
        Signal.Backbone.Views.Lightbox.show(this.lightboxView.el);
        return;
      }

      const selectedIndex = _.findIndex(
        media,
        item => attachment.path === item.path
      );

      const onSave = async (options = {}) => {
        Signal.Types.Attachment.save({
          attachment: options.attachment,
          document,
          index: options.index + 1,
          getAbsolutePath: getAbsoluteAttachmentPath,
          timestamp: options.message.get('sent_at'),
        });
      };

      const props = {
        media,
        selectedIndex: selectedIndex >= 0 ? selectedIndex : 0,
        onSave,
      };
      this.lightboxGalleryView = new Whisper.ReactWrapperView({
        className: 'lightbox-wrapper',
        Component: Signal.Components.LightboxGallery,
        props,
        onClose: () => {
          Signal.Backbone.Views.Lightbox.hide();
          this.stopListening(message);
        },
      });
      this.listenTo(message, 'expired', () =>
        this.lightboxGalleryView.remove()
      );
      Signal.Backbone.Views.Lightbox.show(this.lightboxGalleryView.el);
    },

    showMessageDetail(message) {
      const onClose = () => {
        this.stopListening(message, 'change', update);
        this.resetPanel();
        this.updateHeader();
      };

      const props = message.getPropsForMessageDetail();
      const view = new Whisper.ReactWrapperView({
        className: 'message-detail-wrapper',
        Component: Signal.Components.MessageDetail,
        props,
        onClose,
      });

      const update = () => view.update(message.getPropsForMessageDetail());
      this.listenTo(message, 'change', update);
      this.listenTo(message, 'expired', onClose);
      // We could listen to all involved contacts, but we'll call that overkill

      this.listenBack(view);
      this.updateHeader();
      view.render();
    },

    showContactDetail({ contact, hasSignalAccount }) {
      const regionCode = storage.get('regionCode');
      const { contactSelector } = Signal.Types.Contact;

      const view = new Whisper.ReactWrapperView({
        Component: Signal.Components.ContactDetail,
        className: 'contact-detail-pane panel',
        props: {
          contact: contactSelector(contact, {
            regionCode,
            getAbsoluteAttachmentPath,
          }),
          hasSignalAccount,
          onSendMessage: () => {
            const number =
              contact.number && contact.number[0] && contact.number[0].value;
            if (number) {
              this.openConversation(number);
            }
          },
        },
        onClose: () => {
          this.resetPanel();
          this.updateHeader();
        },
      });

      this.listenBack(view);
      this.updateHeader();
    },

    async openConversation(number) {
      window.Whisper.events.trigger('showConversation', number);
    },

    listenBack(view) {
      this.panels = this.panels || [];
      if (this.panels.length > 0) {
        this.panels[0].$el.hide();
      }
      this.panels.unshift(view);
      view.$el.insertBefore(this.$('.panel').first());
    },
    resetPanel() {
      if (!this.panels || !this.panels.length) {
        return;
      }

      const view = this.panels.shift();

      if (this.panels.length > 0) {
        this.panels[0].$el.show();
      }
      view.remove();

      if (this.panels.length === 0) {
        this.$el.trigger('force-resize');
      }
    },

    endSession() {
      this.model.endSession();
    },

    setDisappearingMessages(seconds) {
      if (seconds > 0) {
        this.model.updateExpirationTimer(seconds);
      } else {
        this.model.updateExpirationTimer(null);
      }
    },

    destroyMessages() {
      const message = this.model.isPublic()
        ? i18n('deletePublicConversationConfirmation')
        : i18n('deleteConversationConfirmation');

      Whisper.events.trigger('showConfirmationDialog', {
        message,
        onOk: async () => {
          try {
            await this.model.destroyMessages();
            this.unload('delete messages');
          } catch (error) {
            window.log.error(
              'destroyMessages: Failed to successfully delete conversation',
              error && error.stack ? error.stack : error
            );
          }
        },
      });
    },

    showSendConfirmationDialog(e, contacts) {
      let message;
      const isUnverified = this.model.isUnverified();

      if (contacts.length > 1) {
        if (isUnverified) {
          message = i18n('changedSinceVerifiedMultiple');
        } else {
          message = i18n('changedRecentlyMultiple');
        }
      } else {
        const contactName = contacts.at(0).getTitle();
        if (isUnverified) {
          message = i18n('changedSinceVerified', [contactName, contactName]);
        } else {
          message = i18n('changedRecently', [contactName, contactName]);
        }
      }

      window.confirmationDialog({
        title: i18n('changedSinceVerifiedTitle'),
        message,
        okText: i18n('sendAnyway'),
        resolve: () => {
          this.checkUnverifiedSendMessage(e, { force: true });
        },
        reject: () => {
          this.focusMessageFieldAndClearDisabled();
        },
      });
    },

    stripQuery(text, cursorPos) {
      const end = text.slice(cursorPos).search(/[^a-fA-F0-9]/);
      const mentionEnd = end === -1 ? text.length : cursorPos + end;

      const stripped = text.substr(0, mentionEnd);

      const mentionStart = stripped.lastIndexOf('@');

      const query = stripped.substr(mentionStart, mentionEnd - mentionStart);

      return [stripped.substr(0, mentionStart), query, text.substr(mentionEnd)];
    },

    selectMember(member) {
      const cursorPos = this.$messageField[0].selectionStart;
      // Note: skipping the middle value here
      const [prev, , end] = this.stripQuery(
        this.$messageField.val(),
        cursorPos
      );

      const handle = this.memberView.addPubkeyMapping(
        member.authorProfileName,
        member.authorPhoneNumber
      );

      let firstHalf = `${prev}${handle}`;
      let newCursorPos = firstHalf.length;

      const needExtraWhitespace = end.length === 0 || /\b/.test(end[0]);
      if (needExtraWhitespace) {
        firstHalf += ' ';
        newCursorPos += 1;
      }

      const result = firstHalf + end;

      this.$messageField.val(result);
      this.$messageField[0].selectionStart = newCursorPos;
      this.$messageField[0].selectionEnd = newCursorPos;
      this.$messageField.trigger('input');
    },

    async handleSubmitPressed(e, options = {}) {
      if (this.memberView.membersShown()) {
        const member = this.memberView.selectedMember();
        this.selectMember(member);
      } else {
        await this.checkUnverifiedSendMessage(e, options);
      }
    },

    async checkUnverifiedSendMessage(e, options = {}) {
      e.preventDefault();
      this.sendStart = Date.now();
      this.$messageField.attr('disabled', true);

      _.defaults(options, { force: false });

      // This will go to the trust store for the latest identity key information,
      //   and may result in the display of a new banner for this conversation.
      try {
        await this.model.updateVerified();
        const contacts = this.model.getUnverified();
        if (!contacts.length) {
          this.checkUntrustedSendMessage(e, options);
          return;
        }

        if (options.force) {
          await this.markAllAsVerifiedDefault(contacts);
          this.checkUnverifiedSendMessage(e, options);
          return;
        }

        this.showSendConfirmationDialog(e, contacts);
      } catch (error) {
        this.focusMessageFieldAndClearDisabled();
        window.log.error(
          'checkUnverifiedSendMessage error:',
          error && error.stack ? error.stack : error
        );
      }
    },

    async checkUntrustedSendMessage(e, options = {}) {
      _.defaults(options, { force: false });

      try {
        const contacts = await this.model.getUntrusted();
        if (!contacts.length) {
          this.sendMessage(e);
          return;
        }

        if (options.force) {
          await this.markAllAsApproved(contacts);
          this.sendMessage(e);
          return;
        }

        this.showSendConfirmationDialog(e, contacts);
      } catch (error) {
        this.focusMessageFieldAndClearDisabled();
        window.log.error(
          'checkUntrustedSendMessage error:',
          error && error.stack ? error.stack : error
        );
      }
    },

    resetMessageSelection() {
      this.model.resetMessageSelection();
    },

    toggleEmojiPanel(e) {
      e.preventDefault();
      if (!this.emojiPanel) {
        this.openEmojiPanel();
      } else {
        this.closeEmojiPanel();
      }
    },
    onKeyDown(event) {
      if (event.key !== 'Escape') {
        return;
      }

      // TODO: this view is not always in focus (e.g. after I've selected a message),
      // so need to make Esc more robust
      // Perhaps look into ConversationHeader.tsx and add an event listener in there.
      // Up and down arrows should scroll
      // Alt + up and down should swap between conversations / setting categories
      this.model.resetMessageSelection();
      this.closeEmojiPanel();
    },
    openEmojiPanel() {
      this.$emojiPanelContainer.outerHeight(200);
      this.emojiPanel = new EmojiPanel(this.$emojiPanelContainer[0], {
        onClick: this.insertEmoji.bind(this),
      });
      this.view.resetScrollPosition();
      this.updateMessageFieldSize({});
    },
    closeEmojiPanel() {
      if (this.emojiPanel === null) {
        return;
      }

      this.$emojiPanelContainer.empty().outerHeight(0);
      this.emojiPanel = null;
      this.view.resetScrollPosition();
      this.updateMessageFieldSize({});
    },
    insertEmoji(e) {
      const colons = `:${emojiData[e.index].short_name}:`;

      const textarea = this.$messageField[0];
      if (textarea.selectionStart || textarea.selectionStart === 0) {
        const startPos = textarea.selectionStart;
        const endPos = textarea.selectionEnd;

        textarea.value =
          textarea.value.substring(0, startPos) +
          colons +
          textarea.value.substring(endPos, textarea.value.length);
        textarea.selectionStart = startPos + colons.length;
        textarea.selectionEnd = startPos + colons.length;
      } else {
        textarea.value += colons;
      }
      this.focusMessageField();
    },

    async setQuoteMessage(message) {
      this.quote = null;
      this.quotedMessage = message;

      if (this.quoteHolder) {
        this.quoteHolder.unload();
        this.quoteHolder = null;
      }

      if (message) {
        const quote = await this.model.makeQuote(this.quotedMessage);
        this.quote = quote;

        this.focusMessageFieldAndClearDisabled();
      }

      this.renderQuotedMessage();
    },

    renderQuotedMessage() {
      if (this.quoteView) {
        this.quoteView.remove();
        this.quoteView = null;
      }
      if (!this.quotedMessage) {
        this.view.restoreBottomOffset();
        this.updateMessageFieldSize({});
        return;
      }

      const message = new Whisper.Message({
        conversationId: this.model.id,
        quote: this.quote,
      });
      message.quotedMessage = this.quotedMessage;
      this.quoteHolder = message;

      const props = message.getPropsForQuote();

      this.listenTo(message, 'scroll-to-message', this.scrollToMessage);

      const contact = this.quotedMessage.getContact();
      if (contact) {
        this.listenTo(contact, 'change', this.renderQuotedMesage);
      }

      this.quoteView = new Whisper.ReactWrapperView({
        className: 'quote-wrapper',
        Component: window.Signal.Components.Quote,
        elCallback: el => this.$('.send').prepend(el),
        props: Object.assign({}, props, {
          withContentAbove: true,
          onClose: () => {
            this.setQuoteMessage(null);
          },
        }),
        onInitialRender: () => {
          this.view.restoreBottomOffset();
          this.updateMessageFieldSize({});
        },
      });
    },

    async sendMessage(e) {
      this.removeLastSeenIndicator();
      this.closeEmojiPanel();
      this.model.clearTypingTimers();

      const input = this.$messageField;

      let message = this.memberView.replaceMentions(input.val());
      message = window.Signal.Emoji.replaceColons(message).trim();

      const toastOptions = { type: 'info' };
      // let it pass if we're still trying to read it or it's false...
      if (extension.expiredStatus() === true) {
        toastOptions.title = i18n('expiredWarning');
        toastOptions.id = 'expiredWarning';
      }
      if (!window.clientClockSynced) {
        // Check to see if user has updated their clock to current time
        const clockSynced = await window.LokiPublicChatAPI.setClockParams();
        if (clockSynced) {
          toastOptions.title = i18n('clockOutOfSync');
          toastOptions.id = 'clockOutOfSync';
        }
      }
      if (this.model.isPrivate() && storage.isBlocked(this.model.id)) {
        toastOptions.title = i18n('unblockToSend');
        toastOptions.id = 'unblockToSend';
      }
      if (!this.model.isPrivate() && storage.isGroupBlocked(this.model.id)) {
        toastOptions.title = i18n('unblockGroupToSend');
        toastOptions.id = 'unblockGroupToSend';
      }
      if (!this.model.isPrivate() && this.model.get('left')) {
        toastOptions.title = i18n('youLeftTheGroup');
        toastOptions.id = 'youLeftTheGroup';
      }
      if (message.length > window.CONSTANTS.MAX_MESSAGE_BODY_LENGTH) {
        toastOptions.title = i18n('messageBodyTooLong');
        toastOptions.id = 'messageBodyTooLong';
      }

      if (toastOptions.title) {
        window.pushToast(toastOptions);
        this.focusMessageFieldAndClearDisabled();
        return;
      }

      try {
        if (!message.length && !this.fileInput.hasFiles()) {
          return;
        }

        const attachments = await this.fileInput.getFiles();
        const sendDelta = Date.now() - this.sendStart;
        window.log.info('Send pre-checks took', sendDelta, 'milliseconds');

        this.model.sendMessage(
          message,
          attachments,
          this.quote,
          this.getLinkPreview()
        );

        input.val('');
        this.memberView.deleteMention();
        this.setQuoteMessage(null);
        this.resetLinkPreview();
        this.focusMessageFieldAndClearDisabled();
        this.forceUpdateMessageFieldSize(e);
        this.fileInput.clearAttachments();
      } catch (error) {
        window.log.error(
          'Error pulling attached files before send',
          error && error.stack ? error.stack : error
        );
      } finally {
        this.focusMessageFieldAndClearDisabled();
      }
    },

    onKeyUp() {
      this.maybeBumpTyping();
      this.debouncedMaybeGrabLinkPreview();
    },

    maybeGrabLinkPreview() {
      // Don't generate link previews if user has turned them off
      if (!storage.get('link-preview-setting', false)) {
        return;
      }
      // Do nothing if we're offline
      if (!textsecure.messaging) {
        return;
      }
      // If we have attachments, don't add link preview
      if (this.fileInput.hasFiles()) {
        return;
      }
      // If we're behind a user-configured proxy, we don't support link previews
      if (window.isBehindProxy()) {
        return;
      }

      const messageText = this.$messageField.val().trim();
      const caretLocation = this.$messageField.get(0).selectionStart;

      if (!messageText) {
        this.resetLinkPreview();
        return;
      }
      if (this.disableLinkPreviews) {
        return;
      }

      const links = window.Signal.LinkPreviews.findLinks(
        messageText,
        caretLocation
      );
      const { currentlyMatchedLink } = this;
      if (links.includes(currentlyMatchedLink)) {
        return;
      }

      this.currentlyMatchedLink = null;
      this.excludedPreviewUrls = this.excludedPreviewUrls || [];

      const link = links.find(
        item =>
          window.Signal.LinkPreviews.isLinkInWhitelist(item) &&
          !this.excludedPreviewUrls.includes(item)
      );
      if (!link) {
        this.removeLinkPreview();
        return;
      }

      this.currentlyMatchedLink = link;
      this.addLinkPreview(link);
    },

    resetLinkPreview() {
      this.disableLinkPreviews = false;
      this.excludedPreviewUrls = [];
      this.removeLinkPreview();
    },

    removeLinkPreview() {
      (this.preview || []).forEach(item => {
        if (item.url) {
          URL.revokeObjectURL(item.url);
        }
      });
      this.preview = null;
      this.previewLoading = null;
      this.currentlyMatchedLink = false;
      this.renderLinkPreview();
    },

    async makeChunkedRequest(url) {
      const PARALLELISM = 3;
      const size = await textsecure.messaging.getProxiedSize(url);
      const chunks = await Signal.LinkPreviews.getChunkPattern(size);

      let results = [];
      const jobs = chunks.map(chunk => async () => {
        const { start, end } = chunk;

        const result = await textsecure.messaging.makeProxiedRequest(url, {
          start,
          end,
          returnArrayBuffer: true,
        });

        return {
          ...chunk,
          ...result,
        };
      });

      while (jobs.length > 0) {
        const activeJobs = [];
        for (let i = 0, max = PARALLELISM; i < max; i += 1) {
          if (!jobs.length) {
            break;
          }

          const job = jobs.shift();
          activeJobs.push(job());
        }

        // eslint-disable-next-line no-await-in-loop
        results = results.concat(await Promise.all(activeJobs));
      }

      if (!results.length) {
        throw new Error('No responses received');
      }

      const { contentType } = results[0];
      const data = Signal.LinkPreviews.assembleChunks(results);

      return {
        contentType,
        data,
      };
    },

    async getPreview(url) {
      let html;
      try {
        html = await textsecure.messaging.makeProxiedRequest(url);
      } catch (error) {
        if (error.code >= 300) {
          return null;
        }
      }

      const title = window.Signal.LinkPreviews.getTitleMetaTag(html);
      const imageUrl = window.Signal.LinkPreviews.getImageMetaTag(html);

      let image;
      let objectUrl;
      try {
        if (imageUrl) {
          if (!Signal.LinkPreviews.isMediaLinkInWhitelist(imageUrl)) {
            const primaryDomain = Signal.LinkPreviews.getDomain(url);
            const imageDomain = Signal.LinkPreviews.getDomain(imageUrl);
            throw new Error(
              `imageUrl for domain ${primaryDomain} did not match media whitelist. Domain: ${imageDomain}`
            );
          }

          const data = await this.makeChunkedRequest(imageUrl);

          // Ensure that this file is either small enough or is resized to meet our
          //   requirements for attachments
          const withBlob = await this.fileInput.autoScale({
            contentType: data.contentType,
            file: new Blob([data.data], {
              type: data.contentType,
            }),
          });

          const attachment = await this.fileInput.readFile(withBlob);
          objectUrl = URL.createObjectURL(withBlob.file);

          const dimensions = await Signal.Types.VisualAttachment.getImageDimensions(
            {
              objectUrl,
              logger: window.log,
            }
          );

          image = {
            ...attachment,
            ...dimensions,
            contentType: withBlob.file.type,
          };
        }
      } catch (error) {
        // We still want to show the preview if we failed to get an image
        window.log.error(
          'getPreview failed to get image for link preview:',
          error.message
        );
      } finally {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      }

      return {
        title,
        url,
        image,
      };
    },

    async addLinkPreview(url) {
      (this.preview || []).forEach(item => {
        if (item.url) {
          URL.revokeObjectURL(item.url);
        }
      });
      this.preview = null;

      this.currentlyMatchedLink = url;
      this.previewLoading = this.getPreview(url);
      const promise = this.previewLoading;
      this.renderLinkPreview();

      try {
        const result = await promise;

        if (
          url !== this.currentlyMatchedLink ||
          promise !== this.previewLoading
        ) {
          // another request was started, or this was canceled
          return;
        }

        // If we couldn't pull down the initial URL
        if (!result) {
          this.excludedPreviewUrls.push(url);
          this.removeLinkPreview();
          return;
        }

        if (result.image) {
          const blob = new Blob([result.image.data], {
            type: result.image.contentType,
          });
          result.image.url = URL.createObjectURL(blob);
        } else if (!result.title) {
          // A link preview isn't worth showing unless we have either a title or an image
          this.removeLinkPreview();
          return;
        }

        this.preview = [result];
        this.renderLinkPreview();
      } catch (error) {
        window.log.error(
          'Problem loading link preview, disabling.',
          error && error.stack ? error.stack : error
        );
        this.disableLinkPreviews = true;
        this.removeLinkPreview();
      }
    },

    renderLinkPreview() {
      if (this.previewView) {
        this.previewView.remove();
        this.previewView = null;
      }
      if (!this.currentlyMatchedLink) {
        this.view.restoreBottomOffset();
        this.updateMessageFieldSize({});
        return;
      }

      const first = (this.preview && this.preview[0]) || null;
      const props = {
        ...first,
        domain: first && window.Signal.LinkPreviews.getDomain(first.url),
        isLoaded: Boolean(first),
        onClose: () => {
          this.disableLinkPreviews = true;
          this.removeLinkPreview();
        },
      };

      this.previewView = new Whisper.ReactWrapperView({
        className: 'preview-wrapper',
        Component: window.Signal.Components.StagedLinkPreview,
        elCallback: el => this.$('.send').prepend(el),
        props,
        onInitialRender: () => {
          this.view.restoreBottomOffset();
          this.updateMessageFieldSize({});
        },
      });
    },

    getLinkPreview() {
      // Don't generate link previews if user has turned them off
      if (!storage.get('link-preview-setting', false)) {
        return [];
      }

      if (!this.preview) {
        return [];
      }

      return this.preview.map(item => {
        if (item.image) {
          // We eliminate the ObjectURL here, unneeded for send or save
          return {
            ...item,
            image: _.omit(item.image, 'url'),
          };
        }

        return item;
      });
    },

    // Called whenever the user changes the message composition field. But only
    //   fires if there's content in the message field after the change.
    maybeBumpTyping() {
      const messageText = this.$messageField.val();
      if (messageText.length) {
        this.model.throttledBumpTyping();
      }
    },

    handleDeleteOrBackspace(event, isDelete) {
      const $input = this.$messageField[0];
      const text = this.$messageField.val();

      // Only handle the case when nothing is selected
      if ($input.selectionDirection !== 'none') {
        // Note: if this ends up deleting a handle, we should
        // (ideally) check if we need to update the mapping in
        // `this.memberView`, but that's not vital as we already
        // reset it on every 'send'
        return;
      }

      const mentions = this.memberView.pendingMentions();

      const _ = window.Lodash; // no underscore.js please
      const predicate = isDelete ? _.startsWith : _.endsWith;

      const pos = $input.selectionStart;
      const part = isDelete ? text.substr(pos) : text.substr(0, pos);

      const curMention = _.keys(mentions).find(key => predicate(part, key));

      if (!curMention) {
        return;
      }

      event.preventDefault();

      const beforeMention = isDelete
        ? text.substr(0, pos)
        : text.substr(0, pos - curMention.length);
      const afterMention = isDelete
        ? text.substr(pos + curMention.length)
        : text.substr(pos);

      const resText = beforeMention + afterMention;
      // NOTE: this doesn't work well with undo/redo, perhaps
      // we should fix it one day
      this.$messageField.val(resText);

      const nextPos = isDelete ? pos : pos - curMention.length;

      $input.selectionStart = nextPos;
      $input.selectionEnd = nextPos;

      this.memberView.deleteMention(curMention);
    },

    handleLeftRight(event, isLeft) {
      // Return next cursor position candidate before we take
      // various modifier keys into account
      const nextPos = (text, cursorPos, isLeft2, isAltPressed) => {
        // If the next char is ' ', skip it if Alt is pressed
        let pos = cursorPos;
        if (isAltPressed) {
          const nextChar = isLeft2
            ? text.substr(pos - 1, 1)
            : text.substr(pos, 1);
          if (nextChar === ' ') {
            pos = isLeft2 ? pos - 1 : pos + 1;
          }
        }

        const part = isLeft2 ? text.substr(0, pos) : text.substr(pos);

        const mentions = this.memberView.pendingMentions();

        const predicate = isLeft2
          ? window.Lodash.endsWith
          : window.Lodash.startsWith;

        const curMention = _.keys(mentions).find(key => predicate(part, key));

        const offset = curMention ? curMention.length : 1;

        const resPos = isLeft2 ? Math.max(0, pos - offset) : pos + offset;

        return resPos;
      };

      event.preventDefault();

      const $input = this.$messageField[0];

      const posStart = $input.selectionStart;
      const posEnd = $input.selectionEnd;

      const text = this.$messageField.val();

      const posToChange =
        $input.selectionDirection === 'forward' ? posEnd : posStart;

      let newPos = nextPos(text, posToChange, isLeft, event.altKey);

      // If command (macos) key is pressed, go to the beginning/end
      // (this shouldn't affect Windows, but we should double check that)
      if (event.metaKey) {
        newPos = isLeft ? 0 : text.length;
      }

      // Alt would normally make the cursor go until the next whitespace,
      // but we need to take the presence of a mention into account
      if (event.altKey || event.ctrlKey) {
        const searchFrom = isLeft ? posToChange - 1 : posToChange + 1;
        const toSearch = isLeft
          ? text.substr(0, searchFrom)
          : text.substr(searchFrom);

        // Note: we don't seem to support tabs etc, thus no /\s/
        let nextAltPos = isLeft
          ? toSearch.lastIndexOf(' ')
          : toSearch.indexOf(' ');

        if (nextAltPos === -1) {
          nextAltPos = isLeft ? 0 : text.length;
        } else if (isLeft) {
          nextAltPos += 1;
        }

        if (isLeft) {
          newPos = Math.min(newPos, nextAltPos);
        } else {
          newPos = Math.max(newPos, nextAltPos + searchFrom);
        }
      }

      // ==== Handle selection business ====
      let newPosStart = newPos;
      let newPosEnd = newPos;

      let direction = $input.selectionDirection;

      if (event.shiftKey) {
        if (direction === 'none') {
          if (isLeft) {
            direction = 'backward';
          } else {
            direction = 'forward';
          }
        }
      } else {
        direction = 'none';
      }

      if (direction === 'forward') {
        newPosStart = posStart;
      } else if (direction === 'backward') {
        newPosEnd = posEnd;
      }

      if (newPosStart === newPosEnd) {
        direction = 'none';
      }

      $input.setSelectionRange(newPosStart, newPosEnd, direction);
    },

    // Note: not only input, but keypresses too (rename?)
    handleInputEvent(event) {
      // Note: schedule the member list handler shortly afterwards, so
      // that the input element has time to update its cursor position to
      // what the user would expect
      if (this.model.get('type') === 'group') {
        window.requestAnimationFrame(this.maybeShowMembers.bind(this, event));
      }

      const keyCode = event.which || event.keyCode;

      if (
        keyCode === 13 &&
        !event.altKey &&
        !event.shiftKey &&
        !event.ctrlKey
      ) {
        // enter pressed - submit the form now
        event.preventDefault();
        this.$('.bottom-bar form').submit();
        return;
      }

      const keyPressedLeft = keyCode === 37;
      const keyPressedUp = keyCode === 38;
      const keyPressedRight = keyCode === 39;
      const keyPressedDown = keyCode === 40;
      const keyPressedTab = keyCode === 9;

      const preventDefault = keyPressedUp || keyPressedDown || keyPressedTab;

      if (this.memberView.membersShown() && preventDefault) {
        if (keyPressedDown) {
          this.memberView.selectDown();
        } else if (keyPressedUp) {
          this.memberView.selectUp();
        } else if (keyPressedTab) {
          // Tab is treated as Enter in this context
          this.handleSubmitPressed();
        }

        const $selected = this.$('.member-selected');
        if ($selected.length) {
          $selected[0].scrollIntoView({ behavior: 'smooth' });
        }
        event.preventDefault();
        return;
      }

      if (keyPressedLeft || keyPressedRight) {
        this.$messageField.trigger('input');
        this.handleLeftRight(event, keyPressedLeft);

        return;
      }

      const keyPressedDelete = keyCode === 46;
      const keyPressedBackspace = keyCode === 8;

      if (keyPressedDelete) {
        this.handleDeleteOrBackspace(event, true);
      }

      if (keyPressedBackspace) {
        this.handleDeleteOrBackspace(event, false);
      }

      this.updateMessageFieldSize();
    },

    updateMessageFieldSize() {
      this.toggleMicrophone();

      this.view.measureScrollPosition();
      window.autosize(this.$messageField);

      const $attachmentPreviews = this.$('.attachment-previews');
      const $bottomBar = this.$('.bottom-bar');
      const includeMargin = true;
      const quoteHeight = this.quoteView
        ? this.quoteView.$el.outerHeight(includeMargin)
        : 0;

      const height =
        this.$messageField.outerHeight() +
        $attachmentPreviews.outerHeight() +
        this.$emojiPanelContainer.outerHeight() +
        quoteHeight +
        parseInt($bottomBar.css('min-height'), 10);

      $bottomBar.outerHeight(height);

      this.view.scrollToBottomIfNeeded();
    },

    async maybeShowMembers(event) {
      const filterMembers = (caseSensitiveQuery, member) => {
        const { authorPhoneNumber, authorProfileName } = member;

        const profileName = authorProfileName
          ? authorProfileName.toLowerCase()
          : '';
        const query = caseSensitiveQuery.toLowerCase();

        if (authorPhoneNumber.includes(query) || profileName.includes(query)) {
          return true;
        }
        return false;
      };

      // This is not quite the same as stripQuery
      // as this one searches until the current
      // cursor position
      const getQuery = (srcLine, cursorPos) => {
        const input = srcLine.substr(0, cursorPos);

        const atPos = input.lastIndexOf('@');
        if (atPos === -1) {
          return null;
        }

        // Whitespace is required right before @ unless
        // the beginning of line
        if (atPos > 0 && /\w/.test(input.substr(atPos - 1, 1))) {
          return null;
        }

        const query = input.substr(atPos + 1);

        // No whitespaces allowed in a query
        if (/\s/.test(query)) {
          return null;
        }

        return query;
      };

      let allMembers;

      if (this.model.isPublic()) {
        // const api = await this.model.getPublicSendData();
        // not quite in the right format tho yet...
        // let members = await api.getSubscribers();
        let members = await window.lokiPublicChatAPI.getListOfMembers();
        members = members
          .filter(d => !!d)
          .filter(d => d.authorProfileName !== 'Anonymous');
        allMembers = _.uniq(members, true, d => d.authorPhoneNumber);
      } else {
        const members = this.model.get('members');
        if (!members || members.length === 0) {
          return;
        }

        const privateConvos = window
          .getConversations()
          .models.filter(d => d.isPrivate());
        const memberConvos = members
          .map(m => privateConvos.find(c => c.id === m))
          .filter(c => !!c && c.getLokiProfile());

        allMembers = memberConvos.map(c => ({
          id: c.id,
          authorPhoneNumber: c.id,
          authorProfileName: c.getLokiProfile().displayName,
        }));
      }

      const cursorPos = event.target.selectionStart;

      // can't use pubkeyPattern here, as we are matching incomplete
      // pubkeys (including the single @)
      const query = getQuery(event.target.value, cursorPos);

      let membersToShow = [];
      if (query !== null) {
        membersToShow =
          query !== ''
            ? allMembers.filter(m => filterMembers(query, m))
            : allMembers;
      }

      membersToShow = membersToShow.map(m =>
        _.pick(m, ['authorPhoneNumber', 'authorProfileName', 'id'])
      );

      this.memberView.updateMembers(membersToShow);
    },

    forceUpdateMessageFieldSize(event) {
      if (this.isHidden()) {
        return;
      }
      this.view.scrollToBottomIfNeeded();
      window.autosize.update(this.$messageField);
      this.updateMessageFieldSize(event);
    },

    isHidden() {
      return (
        this.$el.css('display') === 'none' ||
        this.$('.panel').css('display') === 'none'
      );
    },
  });
})();
