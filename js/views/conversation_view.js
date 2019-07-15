/* global
  $,
  _,
  ConversationController
  extension,
  i18n,
  Signal,
  storage,
  textsecure,
  Whisper,
*/

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};
  const { Message } = window.Signal.Types;
  const {
    upgradeMessageSchema,
    getAbsoluteAttachmentPath,
  } = window.Signal.Migrations;

  Whisper.ExpiredToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('expiredWarning') };
    },
  });
  Whisper.BlockedToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('unblockToSend') };
    },
  });
  Whisper.BlockedGroupToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('unblockGroupToSend') };
    },
  });
  Whisper.LeftGroupToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('youLeftTheGroup') };
    },
  });
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

  const MAX_MESSAGE_BODY_LENGTH = 64 * 1024;
  Whisper.MessageBodyTooLongToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('messageBodyTooLong') };
    },
  });

  Whisper.ConversationLoadingScreen = Whisper.View.extend({
    templateName: 'conversation-loading-screen',
    className: 'conversation-loading-screen',
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
        'send-message': i18n('sendMessage'),
      };
    },
    initialize(options) {
      this.listenTo(this.model, 'destroy', this.stopListening);
      this.listenTo(this.model, 'change:verified', this.onVerifiedChange);
      this.listenTo(this.model, 'newmessage', this.addMessage);
      this.listenTo(this.model, 'opened', this.onOpened);
      this.listenTo(this.model, 'backgrounded', this.resetEmojiResults);
      this.listenTo(this.model, 'prune', this.onPrune);
      this.listenTo(this.model, 'unload', () => this.unload('model trigger'));
      this.listenTo(this.model, 'typing-update', this.renderTypingBubble);
      this.listenTo(
        this.model.messageCollection,
        'show-identity',
        this.showSafetyNumber
      );
      this.listenTo(this.model.messageCollection, 'force-send', this.forceSend);
      this.listenTo(this.model.messageCollection, 'delete', this.deleteMessage);
      this.listenTo(this.model.messageCollection, 'height-changed', () =>
        this.view.scrollToBottomIfNeeded()
      );
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
      this.listenTo(this.model.messageCollection, 'retry', this.retrySend);
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
        'display-tap-to-view-message',
        this.displayTapToViewMessage
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
      this.listenTo(
        this.model.messageCollection,
        'download-new-version',
        () => {
          window.location = 'https://signal.org/download';
        }
      );

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

      this.view = new Whisper.MessageListView({
        collection: this.model.messageCollection,
        window: this.window,
      });
      this.$('.discussion-container').append(this.view.el);
      this.view.render();

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

      this.setupHeader();
      this.setupCompositionArea();
    },

    events: {
      click: 'onClick',
      'click .composition-area-placeholder': 'onClickPlaceholder',
      'click .bottom-bar': 'focusMessageField',
      'click .capture-audio .microphone': 'captureAudio',
      'click .module-scroll-down': 'scrollToBottom',
      'focus .send-message': 'focusBottomBar',
      'blur .send-message': 'unfocusBottomBar',
      'loadMore .message-list': 'loadMoreMessages',
      'newOffscreenMessage .message-list': 'addScrollDownButtonWithCount',
      'atBottom .message-list': 'removeScrollDownButton',
      'farFromBottom .message-list': 'addScrollDownButton',
      'lazyScroll .message-list': 'onLazyScroll',

      'click button.paperclip': 'onChooseAttachment',
      'change input.file-input': 'onChoseAttachment',

      dragover: 'onDragOver',
      dragleave: 'onDragLeave',
      drop: 'onDrop',
      paste: 'onPaste',
    },

    setupHeader() {
      const getHeaderProps = () => {
        const expireTimer = this.model.get('expireTimer');
        const expirationSettingName = expireTimer
          ? Whisper.ExpirationTimerOptions.getName(expireTimer || 0)
          : null;

        return {
          id: this.model.id,
          name: this.model.getName(),
          phoneNumber: this.model.getNumber(),
          profileName: this.model.getProfileName(),
          color: this.model.getColor(),
          avatarPath: this.model.getAvatarPath(),

          isVerified: this.model.isVerified(),
          isMe: this.model.isMe(),
          isGroup: !this.model.isPrivate(),
          isArchived: this.model.get('isArchived'),

          expirationSettingName,
          showBackButton: Boolean(this.panels && this.panels.length),
          timerOptions: Whisper.ExpirationTimerOptions.map(item => ({
            name: item.getName(),
            value: item.get('seconds'),
          })),

          onSetDisappearingMessages: seconds =>
            this.setDisappearingMessages(seconds),
          onDeleteMessages: () => this.destroyMessages(),
          onResetSession: () => this.endSession(),

          // These are view only and don't update the Conversation model, so they
          //   need a manual update call.
          onShowSafetyNumber: () => {
            this.showSafetyNumber();
          },
          onShowAllMedia: async () => {
            await this.showAllMedia();
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

          onArchive: () => {
            this.unload('archive');
            this.model.setArchived(true);
          },
          onMoveToInbox: () => {
            this.model.setArchived(false);
          },
        };
      };
      this.titleView = new Whisper.ReactWrapperView({
        className: 'title-wrapper',
        Component: window.Signal.Components.ConversationHeader,
        props: getHeaderProps(this.model),
      });
      this.updateHeader = () => this.titleView.update(getHeaderProps());
      this.listenTo(this.model, 'change', this.updateHeader);
      this.$('.conversation-header').append(this.titleView.el);
    },

    setupCompositionArea() {
      const compositionApi = { current: null };
      this.compositionApi = compositionApi;

      const props = {
        compositionApi,
        onClickAddPack: () => this.showStickerManager(),
        onPickSticker: (packId, stickerId) =>
          this.sendStickerMessage({ packId, stickerId }),
        onSubmit: message => this.sendMessage(message),
        onDirtyChange: dirty => this.toggleMicrophone(dirty),
        onEditorStateChange: (msg, caretLocation) =>
          this.onEditorStateChange(msg, caretLocation),
        onEditorSizeChange: rect => this.onEditorSizeChange(rect),
      };

      this.compositionAreaView = new Whisper.ReactWrapperView({
        className: 'composition-area-wrapper',
        JSX: Signal.State.Roots.createCompositionArea(window.reduxStore, props),
      });

      // Finally, add it to the DOM
      this.$('.composition-area-placeholder').append(
        this.compositionAreaView.el
      );
    },

    // We need this, or clicking the reactified buttons will submit the form and send any
    //   mid-composition message content.
    onClickPlaceholder(e) {
      e.preventDefault();
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

    unload(reason) {
      window.log.info(
        'unloading conversation',
        this.model.idForLogging(),
        'due to:',
        reason
      );

      this.fileInput.remove();
      this.titleView.remove();
      if (this.stickerButtonView) {
        this.stickerButtonView.remove();
      }

      if (this.stickerPreviewModalView) {
        this.stickerPreviewModalView.remove();
      }

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
      if (this.lightboxView) {
        this.lightboxView.remove();
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

      this.window.removeEventListener('focus', this.onFocus);

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

    toggleMicrophone(dirty = false) {
      if (dirty || this.fileInput.hasFiles()) {
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

      this.disableMessageField();
      this.$('.microphone').hide();
    },
    handleAudioCapture(blob) {
      this.fileInput.addAttachment({
        contentType: blob.type,
        file: blob,
        isVoiceNote: true,
      });
      this.sendMessage();
    },
    endCaptureAudio() {
      this.enableMessageField();
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

      const statusPromise = this.throttledGetProfiles();
      // eslint-disable-next-line more/no-then
      this.statusFetch = statusPromise.then(() =>
        // eslint-disable-next-line more/no-then
        this.model.updateVerified().then(() => {
          this.onVerifiedChange();
          this.statusFetch = null;
          window.log.info('done with status fetch');
        })
      );

      // We schedule our catch-up decrypt right after any in-progress fetch of
      //   messages from the database, then ensure that the loading screen is only
      //   dismissed when that is complete.
      const messagesLoaded = this.inProgressFetch || Promise.resolve();

      // eslint-disable-next-line more/no-then
      messagesLoaded.then(this.onLoaded.bind(this), this.onLoaded.bind(this));

      this.view.resetScrollPosition();
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
      if (this.scrollDownButton) {
        this.scrollDownButton.increment(count);
      } else {
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

    async retrySend(messageId) {
      const message = this.model.messageCollection.get(messageId);
      if (!message) {
        throw new Error(`retrySend: Did not find message for id ${messageId}`);
      }
      await message.retrySend();
    },

    async scrollToMessage(options = {}) {
      const { author, sentAt, referencedMessageNotFound } = options;

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
        if (sentAt !== item.get('sent_at')) {
          return false;
        }

        return true;
      });

      // If there's no message already in memory, we won't be scrolling. So we'll gather
      //   some more information then show an informative toast to the user.
      if (!targetMessage) {
        const collection = await window.Signal.Data.getMessagesBySentAt(
          sentAt,
          {
            MessageCollection: Whisper.MessageCollection,
          }
        );

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
          `Error: had target message ${targetMessage.idForLogging()} in messageCollection, but it was not in DOM`
        );
        return;
      }

      el[0].scrollIntoView();
    },

    async showAllMedia() {
      // We fetch more documents than media as they don’t require to be loaded
      // into memory right away. Revisit this once we have infinite scrolling:
      const DEFAULT_MEDIA_FETCH_COUNT = 50;
      const DEFAULT_DOCUMENTS_FETCH_COUNT = 150;

      const conversationId = this.model.get('id');

      const getProps = async () => {
        const rawMedia = await Signal.Data.getMessagesWithVisualMediaAttachments(
          conversationId,
          {
            limit: DEFAULT_MEDIA_FETCH_COUNT,
            MessageCollection: Whisper.MessageCollection,
          }
        );
        const rawDocuments = await Signal.Data.getMessagesWithFileAttachments(
          conversationId,
          {
            limit: DEFAULT_DOCUMENTS_FETCH_COUNT,
            MessageCollection: Whisper.MessageCollection,
          }
        );

        // First we upgrade these messages to ensure that they have thumbnails
        for (let max = rawMedia.length, i = 0; i < max; i += 1) {
          const message = rawMedia[i];
          const { schemaVersion } = message;

          if (schemaVersion < Message.VERSION_NEEDED_FOR_DISPLAY) {
            // Yep, we really do want to wait for each of these
            // eslint-disable-next-line no-await-in-loop
            rawMedia[i] = await upgradeMessageSchema(message);
            // eslint-disable-next-line no-await-in-loop
            await window.Signal.Data.saveMessage(rawMedia[i], {
              Message: Whisper.Message,
            });
          }
        }

        const media = _.flatten(
          rawMedia.map(message => {
            const { attachments } = message;
            return (attachments || [])
              .filter(
                attachment =>
                  attachment.thumbnail &&
                  !attachment.pending &&
                  !attachment.error
              )
              .map((attachment, index) => {
                const { thumbnail } = attachment;

                return {
                  objectURL: getAbsoluteAttachmentPath(attachment.path),
                  thumbnailObjectUrl: thumbnail
                    ? getAbsoluteAttachmentPath(thumbnail.path)
                    : null,
                  contentType: attachment.contentType,
                  index,
                  attachment,
                  message,
                };
              });
          })
        );

        // Unlike visual media, only one non-image attachment is supported
        const documents = rawDocuments
          .filter(message =>
            Boolean(message.attachments && message.attachments.length)
          )
          .map(message => {
            const attachments = message.attachments || [];
            const attachment = attachments[0];
            return {
              contentType: attachment.contentType,
              index: 0,
              attachment,
              message,
            };
          });

        const saveAttachment = async ({ attachment, message } = {}) => {
          const timestamp = message.sent_at;
          Signal.Types.Attachment.save({
            attachment,
            document,
            getAbsolutePath: getAbsoluteAttachmentPath,
            timestamp,
          });
        };

        const onItemClick = async ({ message, attachment, type }) => {
          switch (type) {
            case 'documents': {
              saveAttachment({ message, attachment });
              break;
            }

            case 'media': {
              const selectedIndex = media.findIndex(
                mediaMessage => mediaMessage.attachment.path === attachment.path
              );
              this.lightboxGalleryView = new Whisper.ReactWrapperView({
                className: 'lightbox-wrapper',
                Component: Signal.Components.LightboxGallery,
                props: {
                  media,
                  onSave: saveAttachment,
                  selectedIndex,
                },
                onClose: () => Signal.Backbone.Views.Lightbox.hide(),
              });
              Signal.Backbone.Views.Lightbox.show(this.lightboxGalleryView.el);
              break;
            }

            default:
              throw new TypeError(`Unknown attachment type: '${type}'`);
          }
        };

        return {
          documents,
          media,
          onItemClick,
        };
      };

      const view = new Whisper.ReactWrapperView({
        className: 'panel-wrapper',
        Component: Signal.Components.MediaGallery,
        props: await getProps(),
        onClose: () => {
          this.stopListening(this.model.messageCollection, 'remove', update);
          this.resetPanel();
        },
      });

      const update = async () => {
        view.update(await getProps());
      };

      this.listenTo(this.model.messageCollection, 'remove', update);

      this.listenBack(view);
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

      const { compositionApi } = this;

      if (compositionApi && compositionApi.current) {
        compositionApi.current.focusInput();
      }
    },

    focusMessageFieldAndClearDisabled() {
      this.compositionApi.current.setDisabled(false);
      this.focusMessageField();
    },

    disableMessageField() {
      this.compositionApi.current.setDisabled(true);
    },

    enableMessageField() {
      this.compositionApi.current.setDisabled(false);
    },

    resetEmojiResults() {
      this.compositionApi.current.resetEmojiResults(false);
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

    forceSend({ contactId, messageId }) {
      const contact = ConversationController.get(contactId);
      const message = this.model.messageCollection.get(messageId);
      if (!message) {
        throw new Error(
          `deleteMessage: Did not find message for id ${messageId}`
        );
      }

      const dialog = new Whisper.ConfirmationDialogView({
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

      this.$el.prepend(dialog.el);
      dialog.focusCancel();
    },

    showSafetyNumber(id) {
      let conversation;

      if (!id && this.model.isPrivate()) {
        // eslint-disable-next-line prefer-destructuring
        conversation = this.model;
      } else {
        conversation = ConversationController.get(id);
      }
      if (conversation) {
        const view = new Whisper.KeyVerificationPanelView({
          model: conversation,
        });
        this.listenBack(view);
        this.updateHeader();
      }
    },

    downloadAttachment({ attachment, timestamp, isDangerous }) {
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
        timestamp,
      });
    },

    async displayTapToViewMessage(messageId) {
      const message = this.model.messageCollection.get(messageId);
      if (!message) {
        throw new Error(
          `displayTapToViewMessage: Did not find message for id ${messageId}`
        );
      }

      if (!message.isTapToView()) {
        throw new Error(
          `displayTapToViewMessage: Message ${message.idForLogging()} is not tap to view`
        );
      }

      if (message.isTapToViewExpired()) {
        return;
      }

      await message.startTapToViewTimer();

      const closeLightbox = () => {
        if (!this.lightboxView) {
          return;
        }

        const { lightboxView } = this;
        this.lightboxView = null;

        this.stopListening(message);
        Signal.Backbone.Views.Lightbox.hide();
        lightboxView.remove();
      };
      this.listenTo(message, 'expired', closeLightbox);
      this.listenTo(message, 'change', () => {
        if (this.lightBoxView) {
          this.lightBoxView.update(getProps());
        }
      });

      const getProps = () => {
        const firstAttachment = message.get('attachments')[0];
        const { path, contentType } = firstAttachment;

        return {
          objectURL: getAbsoluteAttachmentPath(path),
          contentType,
          timerExpiresAt: message.get('messageTimerExpiresAt'),
          timerDuration: message.get('messageTimer') * 1000,
        };
      };
      this.lightboxView = new Whisper.ReactWrapperView({
        className: 'lightbox-wrapper',
        Component: Signal.Components.Lightbox,
        props: getProps(),
        onClose: closeLightbox,
      });

      Signal.Backbone.Views.Lightbox.show(this.lightboxView.el);
    },

    deleteMessage(messageId) {
      const message = this.model.messageCollection.get(messageId);
      if (!message) {
        throw new Error(
          `deleteMessage: Did not find message for id ${messageId}`
        );
      }

      const dialog = new Whisper.ConfirmationDialogView({
        message: i18n('deleteWarning'),
        okText: i18n('delete'),
        resolve: () => {
          window.Signal.Data.removeMessage(message.id, {
            Message: Whisper.Message,
          });
          message.trigger('unload');
          this.model.messageCollection.remove(message.id);
          this.resetPanel();
          this.updateHeader();
        },
      });

      this.$el.prepend(dialog.el);
      dialog.focusCancel();
    },

    showStickerPackPreview(packId, packKey) {
      if (!window.ENABLE_STICKER_SEND) {
        return;
      }

      window.Signal.Stickers.downloadEphemeralPack(packId, packKey);

      const props = {
        packId,
        onClose: async () => {
          this.stickerPreviewModalView.remove();
          this.stickerPreviewModalView = null;
          await window.Signal.Stickers.removeEphemeralPack(packId);
        },
      };

      this.stickerPreviewModalView = new Whisper.ReactWrapperView({
        className: 'sticker-preview-modal-wrapper',
        JSX: Signal.State.Roots.createStickerPreviewModal(
          window.reduxStore,
          props
        ),
      });
    },

    showLightbox({ attachment, messageId }) {
      const message = this.model.messageCollection.get(messageId);
      if (!message) {
        throw new Error(
          `showLightbox: did not find message for id ${messageId}`
        );
      }
      const sticker = message.get('sticker');
      if (sticker) {
        const { packId, packKey } = sticker;
        this.showStickerPackPreview(packId, packKey);
        return;
      }

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
          onSave: () => {
            const timestamp = message.get('sent_at');
            this.downloadAttachment({ attachment, timestamp, message });
          },
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

    showMessageDetail(messageId) {
      const message = this.model.messageCollection.get(messageId);
      if (!message) {
        throw new Error(
          `showMessageDetail: Did not find message for id ${messageId}`
        );
      }

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

    showStickerManager() {
      const view = new Whisper.ReactWrapperView({
        className: ['sticker-manager-wrapper', 'panel'].join(' '),
        JSX: Signal.State.Roots.createStickerManager(window.reduxStore),
        onClose: () => {
          this.resetPanel();
          this.updateHeader();
        },
      });

      this.listenBack(view);
      this.updateHeader();
      view.render();
    },

    showContactDetail({ contact, signalAccount }) {
      const view = new Whisper.ReactWrapperView({
        Component: Signal.Components.ContactDetail,
        className: 'contact-detail-pane panel',
        props: {
          contact,
          signalAccount,
          onSendMessage: () => {
            if (signalAccount) {
              this.openConversation(signalAccount);
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
        // Make sure poppers are positioned properly
        window.dispatchEvent(new Event('resize'));
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

    async destroyMessages() {
      try {
        await this.confirm(i18n('deleteConversationConfirmation'));
        try {
          await this.model.destroyMessages();
          this.unload('delete messages');
          this.model.updateLastMessage();
        } catch (error) {
          window.log.error(
            'destroyMessages: Failed to successfully delete conversation',
            error && error.stack ? error.stack : error
          );
        }
      } catch (error) {
        // nothing to see here, user canceled out of dialog
      }
    },

    showSendAnywayDialog(contacts) {
      return new Promise(resolve => {
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

        const dialog = new Whisper.ConfirmationDialogView({
          message,
          okText: i18n('sendAnyway'),
          resolve: () => resolve(true),
          reject: () => resolve(false),
        });

        this.$el.prepend(dialog.el);
        dialog.focusCancel();
      });
    },

    async sendStickerMessage(options = {}) {
      try {
        const contacts = await this.getUntrustedContacts(options);

        if (contacts && contacts.length) {
          const sendAnyway = await this.showSendAnywayDialog(contacts);
          if (sendAnyway) {
            this.sendStickerMessage({ ...options, force: true });
          }

          return;
        }

        const { packId, stickerId } = options;
        this.model.sendStickerMessage(packId, stickerId);
      } catch (error) {
        window.log.error(
          'clickSend error:',
          error && error.stack ? error.stack : error
        );
      }
    },

    async getUntrustedContacts(options = {}) {
      // This will go to the trust store for the latest identity key information,
      //   and may result in the display of a new banner for this conversation.
      await this.model.updateVerified();
      const unverifiedContacts = this.model.getUnverified();

      if (options.force) {
        if (unverifiedContacts.length) {
          await this.markAllAsVerifiedDefault(unverifiedContacts);
          // We only want force to break us through one layer of checks
          // eslint-disable-next-line no-param-reassign
          options.force = false;
        }
      } else if (unverifiedContacts.length) {
        return unverifiedContacts;
      }

      const untrustedContacts = await this.model.getUntrusted();

      if (options.force) {
        if (untrustedContacts.length) {
          await this.markAllAsApproved(untrustedContacts);
        }
      } else if (untrustedContacts.length) {
        return untrustedContacts;
      }

      return null;
    },

    async setQuoteMessage(messageId) {
      this.quote = null;
      this.quotedMessage = null;

      if (this.quoteHolder) {
        this.quoteHolder.unload();
        this.quoteHolder = null;
      }

      const message = this.model.messageCollection.get(messageId);
      if (message) {
        this.quotedMessage = message;

        if (message) {
          const quote = await this.model.makeQuote(this.quotedMessage);
          this.quote = quote;

          this.focusMessageFieldAndClearDisabled();
        }
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
        },
      });
    },

    async sendMessage(message = '', options = {}) {
      this.sendStart = Date.now();

      try {
        const contacts = await this.getUntrustedContacts(options);
        this.disableMessageField();

        if (contacts && contacts.length) {
          const sendAnyway = await this.showSendAnywayDialog(contacts);
          if (sendAnyway) {
            this.sendMessage(message, { force: true });
            return;
          }

          this.focusMessageFieldAndClearDisabled();
          return;
        }
      } catch (error) {
        this.focusMessageFieldAndClearDisabled();
        window.log.error(
          'sendMessage error:',
          error && error.stack ? error.stack : error
        );
        return;
      }

      this.removeLastSeenIndicator();
      this.model.clearTypingTimers();

      let toast;
      if (extension.expired()) {
        toast = new Whisper.ExpiredToast();
      }
      if (this.model.isPrivate() && storage.isBlocked(this.model.id)) {
        toast = new Whisper.BlockedToast();
      }
      if (!this.model.isPrivate() && storage.isGroupBlocked(this.model.id)) {
        toast = new Whisper.BlockedGroupToast();
      }
      if (!this.model.isPrivate() && this.model.get('left')) {
        toast = new Whisper.LeftGroupToast();
      }
      if (message.length > MAX_MESSAGE_BODY_LENGTH) {
        toast = new Whisper.MessageBodyTooLongToast();
      }

      if (toast) {
        toast.$el.appendTo(this.$el);
        toast.render();
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

        this.compositionApi.current.reset();
        this.setQuoteMessage(null);
        this.resetLinkPreview();
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

    onEditorStateChange(messageText, caretLocation) {
      this.maybeBumpTyping(messageText);
      this.debouncedMaybeGrabLinkPreview(messageText, caretLocation);
    },

    onEditorSizeChange() {
      this.view.scrollToBottomIfNeeded();
    },

    maybeGrabLinkPreview(message, caretLocation) {
      // Don't generate link previews if user has turned them off
      if (!storage.get('linkPreviews', false)) {
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

      if (!message) {
        this.resetLinkPreview();
        return;
      }
      if (this.disableLinkPreviews) {
        return;
      }

      const links = window.Signal.LinkPreviews.findLinks(
        message,
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
      const first = await textsecure.messaging.makeProxiedRequest(url, {
        start: 0,
        end: Signal.Crypto.getRandomValue(1023, 2047),
        returnArrayBuffer: true,
      });
      const { totalSize, result } = first;
      const initialOffset = result.data.byteLength;
      const firstChunk = {
        start: 0,
        end: initialOffset,
        ...result,
      };

      const chunks = await Signal.LinkPreviews.getChunkPattern(
        totalSize,
        initialOffset
      );

      let results = [];
      const jobs = chunks.map(chunk => async () => {
        const { start, end } = chunk;

        const jobResult = await textsecure.messaging.makeProxiedRequest(url, {
          start,
          end,
          returnArrayBuffer: true,
        });

        return {
          ...chunk,
          ...jobResult.result,
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
      const data = Signal.LinkPreviews.assembleChunks(
        [firstChunk].concat(results)
      );

      return {
        contentType,
        data,
      };
    },

    async getStickerPackPreview(url) {
      const isPackDownloaded = pack =>
        pack && (pack.status === 'downloaded' || pack.status === 'installed');
      const isPackValid = pack =>
        pack &&
        (pack.status === 'ephemeral' ||
          pack.status === 'downloaded' ||
          pack.status === 'installed');

      let id;
      let key;

      try {
        ({ id, key } = window.Signal.Stickers.getDataFromLink(url));
        const keyBytes = window.Signal.Crypto.bytesFromHexString(key);
        const keyBase64 = window.Signal.Crypto.arrayBufferToBase64(keyBytes);

        const existing = window.Signal.Stickers.getStickerPack(id);
        if (!isPackDownloaded(existing)) {
          await window.Signal.Stickers.downloadEphemeralPack(id, keyBase64);
        }

        const pack = window.Signal.Stickers.getStickerPack(id);
        if (!isPackValid(pack)) {
          return null;
        }
        if (pack.key !== keyBase64) {
          return null;
        }

        const { title, coverStickerId } = pack;
        const sticker = pack.stickers[coverStickerId];
        const data =
          pack.status === 'ephemeral'
            ? await window.Signal.Migrations.readTempData(sticker.path)
            : await window.Signal.Migrations.readStickerData(sticker.path);

        return {
          title,
          url,
          image: {
            ...sticker,
            data,
            size: data.byteLength,
            contentType: 'image/webp',
          },
        };
      } catch (error) {
        window.log.error(
          'getStickerPackPreview error:',
          error && error.stack ? error.stack : error
        );
        return null;
      } finally {
        if (id) {
          await window.Signal.Stickers.removeEphemeralPack(id);
        }
      }
    },

    async getPreview(url) {
      if (window.Signal.LinkPreviews.isStickerPack(url)) {
        return this.getStickerPackPreview(url);
      }

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
        },
      });
    },

    getLinkPreview() {
      // Don't generate link previews if user has turned them off
      if (!storage.get('linkPreviews', false)) {
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
    maybeBumpTyping(messageText) {
      if (messageText.length) {
        this.model.throttledBumpTyping();
      }
    },

    isHidden() {
      return (
        this.$el.css('display') === 'none' ||
        this.$('.panel').css('display') === 'none'
      );
    },
  });
})();
