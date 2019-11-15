/* global
  $,
  _,
  ConversationController,
  extension,
  i18n,
  loadImage,
  MessageController,
  Signal,
  storage,
  textsecure,
  Whisper,
*/

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};
  const { Message, MIME, VisualAttachment } = window.Signal.Types;
  const {
    upgradeMessageSchema,
    getAbsoluteAttachmentPath,
    getAbsoluteDraftPath,
    copyIntoTempDirectory,
    getAbsoluteTempPath,
    deleteDraftFile,
    deleteTempFile,
    readDraftData,
    writeNewDraftData,
  } = window.Signal.Migrations;
  const {
    getOlderMessagesByConversation,
    getMessageMetricsForConversation,
    getMessageById,
    getMessagesBySentAt,
    getNewerMessagesByConversation,
  } = window.Signal.Data;

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
  Whisper.ConversationArchivedToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('conversationArchived') };
    },
  });
  Whisper.ConversationUnarchivedToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('conversationReturnedToInbox') };
    },
  });

  const MAX_MESSAGE_BODY_LENGTH = 64 * 1024;
  Whisper.MessageBodyTooLongToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('messageBodyTooLong') };
    },
  });

  Whisper.FileSizeToast = Whisper.ToastView.extend({
    templateName: 'file-size-modal',
    render_attributes() {
      return {
        'file-size-warning': i18n('fileSizeWarning'),
        limit: this.model.limit,
        units: this.model.units,
      };
    },
  });
  Whisper.UnableToLoadToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('unableToLoadAttachment') };
    },
  });

  Whisper.DangerousFileTypeToast = Whisper.ToastView.extend({
    template: i18n('dangerousFileType'),
  });
  Whisper.OneNonImageAtATimeToast = Whisper.ToastView.extend({
    template: i18n('oneNonImageAtATimeToast'),
  });
  Whisper.CannotMixImageAndNonImageAttachmentsToast = Whisper.ToastView.extend({
    template: i18n('cannotMixImageAdnNonImageAttachments'),
  });
  Whisper.MaxAttachmentsToast = Whisper.ToastView.extend({
    template: i18n('maximumAttachments'),
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
      // Events on Conversation model
      this.listenTo(this.model, 'destroy', this.stopListening);
      this.listenTo(this.model, 'change:verified', this.onVerifiedChange);
      this.listenTo(this.model, 'newmessage', this.addMessage);
      this.listenTo(this.model, 'opened', this.onOpened);
      this.listenTo(this.model, 'backgrounded', this.resetEmojiResults);
      this.listenTo(this.model, 'scroll-to-message', this.scrollToMessage);
      this.listenTo(this.model, 'unload', reason =>
        this.unload(`model trigger - ${reason}`)
      );
      this.listenTo(this.model, 'focus-composer', this.focusMessageField);
      this.listenTo(this.model, 'open-all-media', this.showAllMedia);
      this.listenTo(this.model, 'begin-recording', this.captureAudio);
      this.listenTo(this.model, 'attach-file', this.onChooseAttachment);
      this.listenTo(this.model, 'escape-pressed', this.resetPanel);
      this.listenTo(this.model, 'show-message-details', this.showMessageDetail);
      this.listenTo(this.model, 'toggle-reply', messageId => {
        const target = this.quote || !messageId ? null : messageId;
        this.setQuoteMessage(target);
      });
      this.listenTo(
        this.model,
        'save-attachment',
        this.downloadAttachmentWrapper
      );
      this.listenTo(this.model, 'delete-message', this.deleteMessage);
      this.listenTo(this.model, 'remove-link-review', this.removeLinkPreview);
      this.listenTo(
        this.model,
        'remove-all-draft-attachments',
        this.clearAttachments
      );

      // Events on Message models - we still listen to these here because they
      //   can be emitted by the non-reduxified MessageDetail pane
      this.listenTo(
        this.model.messageCollection,
        'show-identity',
        this.showSafetyNumber
      );
      this.listenTo(this.model.messageCollection, 'force-send', this.forceSend);
      this.listenTo(this.model.messageCollection, 'delete', this.deleteMessage);
      this.listenTo(
        this.model.messageCollection,
        'show-visual-attachment',
        this.showLightbox
      );
      this.listenTo(
        this.model.messageCollection,
        'display-tap-to-view-message',
        this.displayTapToViewMessage
      );
      this.listenTo(
        this.model.messageCollection,
        'navigate-to',
        this.navigateTo
      );
      this.listenTo(
        this.model.messageCollection,
        'download-new-version',
        this.downloadNewVersion
      );

      this.lazyUpdateVerified = _.debounce(
        this.model.updateVerified.bind(this.model),
        1000 // one second
      );
      this.model.throttledGetProfiles =
        this.model.throttledGetProfiles ||
        _.throttle(
          this.model.getProfiles.bind(this.model),
          1000 * 60 * 5 // five minutes
        );
      this.debouncedMaybeGrabLinkPreview = _.debounce(
        this.maybeGrabLinkPreview.bind(this),
        200
      );
      this.debouncedSaveDraft = _.debounce(this.saveDraft.bind(this), 200);

      this.render();

      this.loadingScreen = new Whisper.ConversationLoadingScreen();
      this.loadingScreen.render();
      this.loadingScreen.$el.prependTo(this.$('.discussion-container'));

      this.window = options.window;
      const attachmentListEl = $(
        '<div class="module-composition-area__attachment-list"></div>'
      );

      this.attachmentListView = new Whisper.ReactWrapperView({
        el: attachmentListEl,
        Component: window.Signal.Components.AttachmentList,
        props: this.getPropsForAttachmentList(),
      });

      extension.windows.onClosed(() => {
        this.unload('windows closed');
      });

      this.setupHeader();
      this.setupTimeline();
      this.setupCompositionArea({ attachmentListEl: attachmentListEl[0] });
    },

    events: {
      'click .composition-area-placeholder': 'onClickPlaceholder',
      'click .bottom-bar': 'focusMessageField',
      'click .capture-audio .microphone': 'captureAudio',
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
          onSearchInConversation: () => {
            const { searchInConversation } = window.reduxActions.search;
            const name = this.model.isMe()
              ? i18n('noteToSelf')
              : this.model.getTitle();
            searchInConversation(this.model.id, name);
          },

          // These are view only and don't update the Conversation model, so they
          //   need a manual update call.
          onShowSafetyNumber: () => {
            this.showSafetyNumber();
          },
          onShowAllMedia: () => {
            this.showAllMedia();
          },
          onShowGroupMembers: async () => {
            await this.showMembers();
            this.updateHeader();
          },
          onGoBack: () => {
            this.resetPanel();
          },

          onArchive: () => {
            this.model.setArchived(true);
            this.model.trigger('unload', 'archive');

            Whisper.ToastView.show(
              Whisper.ConversationArchivedToast,
              document.body
            );
          },
          onMoveToInbox: () => {
            this.model.setArchived(false);

            Whisper.ToastView.show(
              Whisper.ConversationUnarchivedToast,
              document.body
            );
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

    setupCompositionArea({ attachmentListEl }) {
      const compositionApi = { current: null };
      this.compositionApi = compositionApi;

      const micCellEl = $(`
        <div class="capture-audio">
          <button class="microphone"></button>
        </div>
      `)[0];

      const props = {
        id: this.model.id,
        compositionApi,
        onClickAddPack: () => this.showStickerManager(),
        onPickSticker: (packId, stickerId) =>
          this.sendStickerMessage({ packId, stickerId }),
        onSubmit: message => this.sendMessage(message),
        onEditorStateChange: (msg, caretLocation) =>
          this.onEditorStateChange(msg, caretLocation),
        onTextTooLong: () => this.showToast(Whisper.MessageBodyTooLongToast),
        onChooseAttachment: this.onChooseAttachment.bind(this),
        micCellEl,
        attachmentListEl,
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

    setupTimeline() {
      const { id } = this.model;

      const replyToMessage = messageId => {
        this.setQuoteMessage(messageId);
      };
      const retrySend = messageId => {
        this.retrySend(messageId);
      };
      const deleteMessage = messageId => {
        this.deleteMessage(messageId);
      };
      const showMessageDetail = messageId => {
        this.showMessageDetail(messageId);
      };
      const openConversation = (conversationId, messageId) => {
        this.openConversation(conversationId, messageId);
      };
      const showContactDetail = options => {
        this.showContactDetail(options);
      };
      const showVisualAttachment = options => {
        this.showLightbox(options);
      };
      const downloadAttachment = options => {
        this.downloadAttachment(options);
      };
      const displayTapToViewMessage = messageId =>
        this.displayTapToViewMessage(messageId);
      const showIdentity = conversationId => {
        this.showSafetyNumber(conversationId);
      };
      const openLink = url => {
        this.navigateTo(url);
      };
      const downloadNewVersion = () => {
        this.downloadNewVersion();
      };

      const scrollToQuotedMessage = async options => {
        const { author, sentAt } = options;

        const conversationId = this.model.id;
        const messages = await getMessagesBySentAt(sentAt, {
          MessageCollection: Whisper.MessageCollection,
        });
        const message = messages.find(
          item =>
            item.get('conversationId') === conversationId &&
            item.getSource() === author
        );

        if (!message) {
          this.showToast(Whisper.OriginalNotFoundToast);
          return;
        }

        this.scrollToMessage(message.id);
      };

      const loadOlderMessages = async oldestMessageId => {
        const {
          messagesAdded,
          setMessagesLoading,
        } = window.reduxActions.conversations;
        const conversationId = this.model.id;

        setMessagesLoading(conversationId, true);
        const finish = this.setInProgressFetch();

        try {
          const message = await getMessageById(oldestMessageId, {
            Message: Whisper.Message,
          });
          if (!message) {
            throw new Error(
              `loadOlderMessages: failed to load message ${oldestMessageId}`
            );
          }

          const receivedAt = message.get('received_at');
          const models = await getOlderMessagesByConversation(conversationId, {
            receivedAt,
            limit: 500,
            MessageCollection: Whisper.MessageCollection,
          });

          if (models.length < 1) {
            window.log.warn(
              'loadOlderMessages: requested, but loaded no messages'
            );
            return;
          }

          const cleaned = await this.cleanModels(models);
          this.model.messageCollection.add(cleaned);

          const isNewMessage = false;
          messagesAdded(
            id,
            models.map(model => model.getReduxData()),
            isNewMessage,
            window.isActive()
          );
        } catch (error) {
          setMessagesLoading(conversationId, true);
          throw error;
        } finally {
          finish();
        }
      };
      const loadNewerMessages = async newestMessageId => {
        const {
          messagesAdded,
          setMessagesLoading,
        } = window.reduxActions.conversations;
        const conversationId = this.model.id;

        setMessagesLoading(conversationId, true);
        const finish = this.setInProgressFetch();

        try {
          const message = await getMessageById(newestMessageId, {
            Message: Whisper.Message,
          });
          if (!message) {
            throw new Error(
              `loadNewerMessages: failed to load message ${newestMessageId}`
            );
          }

          const receivedAt = message.get('received_at');
          const models = await getNewerMessagesByConversation(this.model.id, {
            receivedAt,
            limit: 500,
            MessageCollection: Whisper.MessageCollection,
          });

          if (models.length < 1) {
            window.log.warn(
              'loadNewerMessages: requested, but loaded no messages'
            );
            return;
          }

          const cleaned = await this.cleanModels(models);
          this.model.messageCollection.add(cleaned);

          const isNewMessage = false;
          messagesAdded(
            id,
            models.map(model => model.getReduxData()),
            isNewMessage,
            window.isActive()
          );
        } catch (error) {
          setMessagesLoading(conversationId, false);
          throw error;
        } finally {
          finish();
        }
      };
      const markMessageRead = async messageId => {
        if (!window.isActive()) {
          return;
        }

        const message = await getMessageById(messageId, {
          Message: Whisper.Message,
        });
        if (!message) {
          throw new Error(
            `markMessageRead: failed to load message ${messageId}`
          );
        }

        await this.model.markRead(message.get('received_at'));
      };

      this.timelineView = new Whisper.ReactWrapperView({
        className: 'timeline-wrapper',
        JSX: Signal.State.Roots.createTimeline(window.reduxStore, {
          id,

          deleteMessage,
          displayTapToViewMessage,
          downloadAttachment,
          downloadNewVersion,
          loadNewerMessages,
          loadNewestMessages: this.loadNewestMessages.bind(this),
          loadAndScroll: this.loadAndScroll.bind(this),
          loadOlderMessages,
          markMessageRead,
          openConversation,
          openLink,
          replyToMessage,
          retrySend,
          scrollToQuotedMessage,
          showContactDetail,
          showIdentity,
          showMessageDetail,
          showVisualAttachment,
        }),
      });

      this.$('.timeline-placeholder').append(this.timelineView.el);
    },

    showToast(ToastView) {
      const toast = new ToastView();
      toast.$el.appendTo(this.$el);
      toast.render();
    },

    async cleanModels(collection) {
      const result = collection
        .filter(message => Boolean(message.id))
        .map(message => MessageController.register(message.id, message));

      const eliminated = collection.length - result.length;
      if (eliminated > 0) {
        window.log.warn(
          `cleanModels: Eliminated ${eliminated} messages without an id`
        );
      }

      for (let max = result.length, i = 0; i < max; i += 1) {
        const message = result[i];
        const { attributes } = message;
        const { schemaVersion } = attributes;

        if (schemaVersion < Message.VERSION_NEEDED_FOR_DISPLAY) {
          // Yep, we really do want to wait for each of these
          // eslint-disable-next-line no-await-in-loop
          const upgradedMessage = await upgradeMessageSchema(attributes);
          message.set(upgradedMessage);
          // eslint-disable-next-line no-await-in-loop
          await window.Signal.Data.saveMessage(upgradedMessage, {
            Message: Whisper.Message,
          });
        }
      }

      return result;
    },

    async scrollToMessage(messageId) {
      const message = await getMessageById(messageId, {
        Message: Whisper.Message,
      });
      if (!message) {
        throw new Error(`scrollToMessage: failed to load message ${messageId}`);
      }

      if (this.model.messageCollection.get(messageId)) {
        const { scrollToMessage } = window.reduxActions.conversations;
        scrollToMessage(this.model.id, messageId);
        return;
      }

      this.loadAndScroll(messageId);
    },

    setInProgressFetch() {
      let resolvePromise;
      this.model.inProgressFetch = new Promise(resolve => {
        resolvePromise = resolve;
      });

      const finish = () => {
        resolvePromise();
        this.model.inProgressFinish = null;
      };

      return finish;
    },

    async loadAndScroll(messageId, options) {
      const { disableScroll } = options || {};
      const {
        messagesReset,
        setMessagesLoading,
      } = window.reduxActions.conversations;
      const conversationId = this.model.id;

      setMessagesLoading(conversationId, true);
      const finish = this.setInProgressFetch();

      try {
        const message = await getMessageById(messageId, {
          Message: Whisper.Message,
        });
        if (!message) {
          throw new Error(
            `loadMoreAndScroll: failed to load message ${messageId}`
          );
        }

        const receivedAt = message.get('received_at');
        const older = await getOlderMessagesByConversation(conversationId, {
          limit: 250,
          receivedAt,
          MessageCollection: Whisper.MessageCollection,
        });
        const newer = await getNewerMessagesByConversation(conversationId, {
          limit: 250,
          receivedAt,
          MessageCollection: Whisper.MessageCollection,
        });
        const metrics = await getMessageMetricsForConversation(conversationId);

        const all = [...older.models, message, ...newer.models];

        const cleaned = await this.cleanModels(all);
        this.model.messageCollection.reset(cleaned);
        const scrollToMessageId = disableScroll ? undefined : messageId;

        messagesReset(
          conversationId,
          cleaned.map(model => model.getReduxData()),
          metrics,
          scrollToMessageId
        );
      } catch (error) {
        setMessagesLoading(conversationId, false);
        throw error;
      } finally {
        finish();
      }
    },

    async loadNewestMessages(newestMessageId, setFocus) {
      const {
        messagesReset,
        setMessagesLoading,
      } = window.reduxActions.conversations;
      const conversationId = this.model.id;

      setMessagesLoading(conversationId, true);
      const finish = this.setInProgressFetch();

      try {
        let scrollToLatestUnread = true;

        if (newestMessageId) {
          const message = await getMessageById(newestMessageId, {
            Message: Whisper.Message,
          });
          if (!message) {
            window.log.warn(
              `loadNewestMessages: did not find message ${newestMessageId}`
            );
          }

          // If newest in-memory message is unread, scrolling down would mean going to
          //   the very bottom, not the oldest unread.
          scrollToLatestUnread = !message.isUnread();
        }

        const metrics = await getMessageMetricsForConversation(conversationId);

        if (scrollToLatestUnread && metrics.oldestUnread) {
          this.loadAndScroll(metrics.oldestUnread.id, {
            disableScroll: !setFocus,
          });
          return;
        }

        const messages = await getOlderMessagesByConversation(conversationId, {
          limit: 500,
          MessageCollection: Whisper.MessageCollection,
        });

        const cleaned = await this.cleanModels(messages);
        this.model.messageCollection.reset(cleaned);
        const scrollToMessageId =
          setFocus && metrics.newest ? metrics.newest.id : undefined;

        messagesReset(
          conversationId,
          cleaned.map(model => model.getReduxData()),
          metrics,
          scrollToMessageId
        );
      } catch (error) {
        setMessagesLoading(conversationId, false);
        throw error;
      } finally {
        finish();
      }
    },

    // We need this, or clicking the reactified buttons will submit the form and send any
    //   mid-composition message content.
    onClickPlaceholder(e) {
      e.preventDefault();
    },

    onChooseAttachment() {
      this.$('input.file-input').click();
    },
    async onChoseAttachment() {
      const fileField = this.$('input.file-input');
      const files = fileField.prop('files');

      for (let i = 0, max = files.length; i < max; i += 1) {
        const file = files[i];
        // eslint-disable-next-line no-await-in-loop
        await this.maybeAddAttachment(file);
        this.toggleMicrophone();
      }

      fileField.val(null);
    },

    unload(reason) {
      window.log.info(
        'unloading conversation',
        this.model.idForLogging(),
        'due to:',
        reason
      );

      const { conversationUnloaded } = window.reduxActions.conversations;
      if (conversationUnloaded) {
        conversationUnloaded(this.model.id);
      }

      if (this.model.get('draftChanged')) {
        if (this.model.hasDraft()) {
          this.model.set({
            draftChanged: false,
            draftTimestamp: Date.now(),
            timestamp: Date.now(),
          });
        } else {
          this.model.set({
            draftChanged: false,
            draftTimestamp: null,
          });
        }

        // We don't wait here; we need to take down the view
        this.saveModel();

        this.model.updateLastMessage();
      }

      this.titleView.remove();
      this.timelineView.remove();
      this.compositionAreaView.remove();

      if (this.attachmentListView) {
        this.attachmentListView.remove();
      }
      if (this.captionEditorView) {
        this.captionEditorView.remove();
      }
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

      this.remove();

      this.model.messageCollection.reset([]);
    },

    navigateTo(url) {
      window.location = url;
    },

    downloadNewVersion() {
      window.location = 'https://signal.org/download';
    },

    onDragOver(e) {
      if (e.originalEvent.dataTransfer.types[0] !== 'Files') {
        return;
      }

      e.stopPropagation();
      e.preventDefault();
      this.$el.addClass('dropoff');
    },

    onDragLeave(e) {
      if (e.originalEvent.dataTransfer.types[0] !== 'Files') {
        return;
      }

      e.stopPropagation();
      e.preventDefault();
    },

    async onDrop(e) {
      if (e.originalEvent.dataTransfer.types[0] !== 'Files') {
        return;
      }

      e.stopPropagation();
      e.preventDefault();

      const { files } = e.originalEvent.dataTransfer;
      for (let i = 0, max = files.length; i < max; i += 1) {
        const file = files[i];
        // eslint-disable-next-line no-await-in-loop
        await this.maybeAddAttachment(file);
      }
    },

    onPaste(e) {
      const { items } = e.originalEvent.clipboardData;
      let imgBlob = null;
      for (let i = 0; i < items.length; i += 1) {
        if (items[i].type.split('/')[0] === 'image') {
          imgBlob = items[i].getAsFile();
        }
      }
      if (imgBlob !== null) {
        const file = imgBlob;
        this.maybeAddAttachment(file);

        e.stopPropagation();
        e.preventDefault();
      }
    },

    getPropsForAttachmentList() {
      const draftAttachments = this.model.get('draftAttachments') || [];

      return {
        // In conversation model/redux
        attachments: draftAttachments.map(attachment => ({
          ...attachment,
          url: attachment.screenshotPath
            ? getAbsoluteDraftPath(attachment.screenshotPath)
            : getAbsoluteDraftPath(attachment.path),
        })),
        // Passed in from ConversationView
        onAddAttachment: this.onChooseAttachment.bind(this),
        onClickAttachment: this.onClickAttachment.bind(this),
        onCloseAttachment: this.onCloseAttachment.bind(this),
        onClose: this.clearAttachments.bind(this),
      };
    },

    onClickAttachment(attachment) {
      const getProps = () => ({
        url: attachment.url,
        caption: attachment.caption,
        attachment,
        onSave,
      });

      const onSave = caption => {
        this.model.set({
          draftAttachments: this.model.get('draftAttachments').map(item => {
            if (
              (item.path && item.path === attachment.path) ||
              (item.screenshotPath &&
                item.screenshotPath === attachment.screenshotPath)
            ) {
              return {
                ...attachment,
                caption,
              };
            }

            return item;
          }),
          draftChanged: true,
        });

        this.captionEditorView.remove();
        Signal.Backbone.Views.Lightbox.hide();

        this.updateAttachmentsView();
        this.saveModel();
      };

      this.captionEditorView = new Whisper.ReactWrapperView({
        className: 'attachment-list-wrapper',
        Component: window.Signal.Components.CaptionEditor,
        props: getProps(),
        onClose: () => Signal.Backbone.Views.Lightbox.hide(),
      });
      Signal.Backbone.Views.Lightbox.show(this.captionEditorView.el);
    },

    async deleteDraftAttachment(attachment) {
      if (attachment.screenshotPath) {
        await deleteDraftFile(attachment.screenshotPath);
      }
      if (attachment.path) {
        await deleteDraftFile(attachment.path);
      }
    },

    async saveModel() {
      window.Signal.Data.updateConversation(
        this.model.id,
        this.model.attributes,
        {
          Conversation: Whisper.Conversation,
        }
      );
    },

    async addAttachment(attachment) {
      const onDisk = await this.writeDraftAttachment(attachment);

      const draftAttachments = this.model.get('draftAttachments') || [];
      this.model.set({
        draftAttachments: [...draftAttachments, onDisk],
        draftChanged: true,
      });
      await this.saveModel();

      this.updateAttachmentsView();
    },

    async onCloseAttachment(attachment) {
      const draftAttachments = this.model.get('draftAttachments') || [];

      this.model.set({
        draftAttachments: _.reject(
          draftAttachments,
          item => item.path === attachment.path
        ),
        draftChanged: true,
      });

      this.updateAttachmentsView();

      await this.saveModel();
      await this.deleteDraftAttachment(attachment);
    },

    async clearAttachments() {
      this.voiceNoteAttachment = null;

      const draftAttachments = this.model.get('draftAttachments') || [];
      this.model.set({
        draftAttachments: [],
        draftChanged: true,
      });

      this.updateAttachmentsView();

      // We're fine doing this all at once; at most it should be 32 attachments
      await Promise.all([
        this.saveModel(),
        Promise.all(
          draftAttachments.map(attachment =>
            this.deleteDraftAttachment(attachment)
          )
        ),
      ]);
    },

    hasFiles() {
      const draftAttachments = this.model.get('draftAttachments') || [];
      return draftAttachments.length > 0;
    },

    async getFiles() {
      if (this.voiceNoteAttachment) {
        // We don't need to pull these off disk; we return them as-is
        return [this.voiceNoteAttachment];
      }

      const draftAttachments = this.model.get('draftAttachments') || [];
      const files = _.compact(
        await Promise.all(
          draftAttachments.map(attachment => this.getFile(attachment))
        )
      );
      return files;
    },

    async getFile(attachment) {
      if (!attachment) {
        return Promise.resolve();
      }

      const data = await readDraftData(attachment.path);
      if (data.byteLength !== attachment.size) {
        window.log.error(
          `Attachment size from disk ${
            data.byteLength
          } did not match attachment size ${attachment.size}`
        );
        return null;
      }

      return {
        ..._.pick(attachment, ['contentType', 'fileName', 'size', 'caption']),
        data,
      };
    },

    arrayBufferFromFile(file) {
      return new Promise((resolve, reject) => {
        const FR = new FileReader();
        FR.onload = e => {
          resolve(e.target.result);
        };
        FR.onerror = reject;
        FR.onabort = reject;
        FR.readAsArrayBuffer(file);
      });
    },

    showFileSizeError({ limit, units, u }) {
      const toast = new Whisper.FileSizeToast({
        model: { limit, units: units[u] },
      });
      toast.$el.insertAfter(this.$el);
      toast.render();
    },

    updateAttachmentsView() {
      this.attachmentListView.update(this.getPropsForAttachmentList());
      this.toggleMicrophone();
      if (this.hasFiles()) {
        this.removeLinkPreview();
      }
    },

    async writeDraftAttachment(attachment) {
      let toWrite = attachment;

      if (toWrite.data) {
        const path = await writeNewDraftData(toWrite.data);
        toWrite = {
          ..._.omit(toWrite, ['data']),
          path,
        };
      }
      if (toWrite.screenshotData) {
        const screenshotPath = await writeNewDraftData(toWrite.screenshotData);
        toWrite = {
          ..._.omit(toWrite, ['screenshotData']),
          screenshotPath,
        };
      }

      return toWrite;
    },

    async maybeAddAttachment(file) {
      if (!file) {
        return;
      }

      const MB = 1000 * 1024;
      if (file.size > 100 * MB) {
        this.showFileSizeError({ limit: 100, units: ['MB'], u: 0 });
        return;
      }

      if (window.Signal.Util.isFileDangerous(file.name)) {
        this.showToast(Whisper.DangerousFileTypeToast);
        return;
      }

      const draftAttachments = this.model.get('draftAttachments') || [];
      if (draftAttachments.length >= 32) {
        this.showToast(Whisper.MaxAttachmentsToast);
        return;
      }

      const haveNonImage = _.any(
        draftAttachments,
        attachment => !MIME.isImage(attachment.contentType)
      );
      // You can't add another attachment if you already have a non-image staged
      if (haveNonImage) {
        this.showToast(Whisper.OneNonImageAtATimeToast);
        return;
      }

      // You can't add a non-image attachment if you already have attachments staged
      if (!MIME.isImage(file.type) && draftAttachments.length > 0) {
        this.showToast(Whisper.CannotMixImageAndNonImageAttachmentsToast);
        return;
      }

      let attachment;

      try {
        if (Signal.Util.GoogleChrome.isImageTypeSupported(file.type)) {
          attachment = await this.handleImageAttachment(file);
        } else if (Signal.Util.GoogleChrome.isVideoTypeSupported(file.type)) {
          attachment = await this.handleVideoAttachment(file);
        } else {
          const data = await this.arrayBufferFromFile(file);
          attachment = {
            data,
            size: data.byteLength,
            contentType: file.type,
            fileName: file.name,
          };
        }
      } catch (e) {
        window.log.error(
          `Was unable to generate thumbnail for file type ${file.type}`,
          e && e.stack ? e.stack : e
        );
        const data = await this.arrayBufferFromFile(file);
        attachment = {
          data,
          size: data.byteLength,
          contentType: file.type,
          fileName: file.name,
        };
      }

      try {
        if (!this.isSizeOkay(attachment)) {
          return;
        }
      } catch (error) {
        window.log.error(
          'Error ensuring that image is properly sized:',
          error && error.stack ? error.stack : error
        );

        this.showToast(Whisper.UnableToLoadToast);
        return;
      }

      await this.addAttachment(attachment);
    },

    isSizeOkay(attachment) {
      let limitKb = 1000000;
      const type =
        attachment.contentType === 'image/gif'
          ? 'gif'
          : attachment.contentType.split('/')[0];

      switch (type) {
        case 'image':
          limitKb = 6000;
          break;
        case 'gif':
          limitKb = 25000;
          break;
        case 'audio':
          limitKb = 100000;
          break;
        case 'video':
          limitKb = 100000;
          break;
        default:
          limitKb = 100000;
          break;
      }
      if ((attachment.data.byteLength / 1024).toFixed(4) >= limitKb) {
        const units = ['kB', 'MB', 'GB'];
        let u = -1;
        let limit = limitKb * 1000;
        do {
          limit /= 1000;
          u += 1;
        } while (limit >= 1000 && u < units.length - 1);
        this.showFileSizeError({ limit, units, u });
        return false;
      }

      return true;
    },

    async handleVideoAttachment(file) {
      const objectUrl = URL.createObjectURL(file);
      if (!objectUrl) {
        throw new Error('Failed to create object url for video!');
      }
      try {
        const screenshotContentType = 'image/png';
        const screenshotBlob = await VisualAttachment.makeVideoScreenshot({
          objectUrl,
          contentType: screenshotContentType,
          logger: window.log,
        });
        const screenshotData = await VisualAttachment.blobToArrayBuffer(
          screenshotBlob
        );
        const data = await this.arrayBufferFromFile(file);

        return {
          fileName: file.name,
          screenshotContentType,
          screenshotData,
          screenshotSize: screenshotData.byteLength,
          contentType: file.type,
          data,
          size: data.byteLength,
        };
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    },

    async handleImageAttachment(file) {
      if (MIME.isJPEG(file.type)) {
        const rotatedDataUrl = await window.autoOrientImage(file);
        const rotatedBlob = window.dataURLToBlobSync(rotatedDataUrl);
        const {
          contentType,
          file: resizedBlob,
          fileName,
        } = await this.autoScale({
          contentType: file.type,
          fileName: file.name,
          file: rotatedBlob,
        });
        const data = await await VisualAttachment.blobToArrayBuffer(
          resizedBlob
        );

        return {
          fileName: fileName || file.name,
          contentType,
          data,
          size: data.byteLength,
        };
      }

      const { contentType, file: resizedBlob, fileName } = await this.autoScale(
        {
          contentType: file.type,
          fileName: file.name,
          file,
        }
      );
      const data = await await VisualAttachment.blobToArrayBuffer(resizedBlob);
      return {
        fileName: fileName || file.name,
        contentType,
        data,
        size: data.byteLength,
      };
    },

    autoScale(attachment) {
      const { contentType, file, fileName } = attachment;
      if (
        contentType.split('/')[0] !== 'image' ||
        contentType === 'image/tiff'
      ) {
        // nothing to do
        return Promise.resolve(attachment);
      }

      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = document.createElement('img');
        img.onerror = reject;
        img.onload = () => {
          URL.revokeObjectURL(url);

          const maxSize = 6000 * 1024;
          const maxHeight = 4096;
          const maxWidth = 4096;
          if (
            img.naturalWidth <= maxWidth &&
            img.naturalHeight <= maxHeight &&
            file.size <= maxSize
          ) {
            resolve(attachment);
            return;
          }

          const gifMaxSize = 25000 * 1024;
          if (file.type === 'image/gif' && file.size <= gifMaxSize) {
            resolve(attachment);
            return;
          }

          if (file.type === 'image/gif') {
            reject(new Error('GIF is too large'));
            return;
          }

          const targetContentType = 'image/jpeg';
          const canvas = loadImage.scale(img, {
            canvas: true,
            maxWidth,
            maxHeight,
          });

          let quality = 0.95;
          let i = 4;
          let blob;
          do {
            i -= 1;
            blob = window.dataURLToBlobSync(
              canvas.toDataURL(targetContentType, quality)
            );
            quality = quality * maxSize / blob.size;
            // NOTE: During testing with a large image, we observed the
            // `quality` value being > 1. Should we clamp it to [0.5, 1.0]?
            // See: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob#Syntax
            if (quality < 0.5) {
              quality = 0.5;
            }
          } while (i > 0 && blob.size > maxSize);

          resolve({
            ...attachment,
            fileName: this.fixExtension(fileName, targetContentType),
            contentType: targetContentType,
            file: blob,
          });
        };
        img.src = url;
      });
    },

    getFileName(fileName) {
      if (!fileName) {
        return '';
      }

      if (!fileName.includes('.')) {
        return fileName;
      }

      return fileName
        .split('.')
        .slice(0, -1)
        .join('.');
    },

    getType(contentType) {
      if (!contentType) {
        return '';
      }

      if (!contentType.includes('/')) {
        return contentType;
      }

      return contentType.split('/')[1];
    },

    fixExtension(fileName, contentType) {
      const extension = this.getType(contentType);
      const name = this.getFileName(fileName);
      return `${name}.${extension}`;
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
        this.showSafetyNumber(unverified.at(0).id);
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

    toggleMicrophone() {
      this.compositionApi.current.setShowMic(!this.hasFiles());
    },

    captureAudio(e) {
      if (e) {
        e.preventDefault();
      }

      if (this.compositionApi.current.isDirty()) {
        return;
      }

      if (this.hasFiles()) {
        this.showToast(Whisper.VoiceNoteMustBeOnlyAttachmentToast);
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
      view.$('.finish').focus();
      this.compositionApi.current.setMicActive(true);

      this.disableMessageField();
      this.$('.microphone').hide();
    },
    async handleAudioCapture(blob) {
      if (this.hasFiles()) {
        throw new Error('A voice note cannot be sent with other attachments');
      }

      const data = await this.arrayBufferFromFile(blob);

      // These aren't persisted to disk; they are meant to be sent immediately
      this.voiceNoteAttachment = {
        contentType: blob.type,
        data,
        size: data.byteLength,
        flags: textsecure.protobuf.AttachmentPointer.Flags.VOICE_MESSAGE,
      };

      // Note: The RecorderView removes itself on send
      this.captureAudioView = null;

      this.sendMessage();
    },
    endCaptureAudio() {
      this.enableMessageField();
      this.$('.microphone').show();

      // Note: The RecorderView removes itself on close
      this.captureAudioView = null;

      this.compositionApi.current.setMicActive(false);
    },

    async onOpened(messageId) {
      if (messageId) {
        const message = await getMessageById(messageId, {
          Message: Whisper.Message,
        });

        if (message) {
          this.loadAndScroll(messageId);
          return;
        }

        window.log.warn(`onOpened: Did not find message ${messageId}`);
      }

      this.loadNewestMessages();

      this.focusMessageField();

      const quotedMessageId = this.model.get('quotedMessageId');
      if (quotedMessageId) {
        this.setQuoteMessage(quotedMessageId);
      }

      this.model.updateLastMessage();

      const statusPromise = this.model.throttledGetProfiles();
      // eslint-disable-next-line more/no-then
      this.statusFetch = statusPromise.then(() =>
        // eslint-disable-next-line more/no-then
        this.model.updateVerified().then(() => {
          this.onVerifiedChange();
          this.statusFetch = null;
        })
      );
    },

    async retrySend(messageId) {
      const message = this.model.messageCollection.get(messageId);
      if (!message) {
        throw new Error(`retrySend: Did not find message for id ${messageId}`);
      }
      await message.retrySend();
    },

    async showAllMedia() {
      if (this.panels && this.panels.length > 0) {
        return;
      }

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
        className: 'panel',
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
      this.updateHeader();
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

    async addMessage(message) {
      // This is debounced, so it won't hit the database too often.
      this.lazyUpdateVerified();

      // We do this here because we don't want convo.messageCollection to have
      //   anything in it unless it has an associated view. This is so, when we
      //   fetch on open, it's clean.
      this.model.addSingleMessage(message);
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

    downloadAttachmentWrapper(messageId) {
      const message = this.model.messageCollection.get(messageId);
      if (!message) {
        throw new Error(
          `downloadAttachmentWrapper: Did not find message for id ${messageId}`
        );
      }

      const { attachments, sent_at: timestamp } = message.attributes;
      if (!attachments || attachments.length < 1) {
        return;
      }

      const attachment = attachments[0];
      const { fileName } = attachment;

      const isDangerous = window.Signal.Util.isFileDangerous(fileName || '');

      this.downloadAttachment({ attachment, timestamp, isDangerous });
    },

    downloadAttachment({ attachment, timestamp, isDangerous }) {
      if (isDangerous) {
        this.showToast(Whisper.DangerousFileTypeToast);
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
          `displayTapToViewMessage: Message ${message.idForLogging()} is not a tap to view message`
        );
      }

      if (message.isErased()) {
        throw new Error(
          `displayTapToViewMessage: Message ${message.idForLogging()} is already erased`
        );
      }

      const firstAttachment = message.get('attachments')[0];
      if (!firstAttachment || !firstAttachment.path) {
        throw new Error(
          `displayTapToViewMessage: Message ${message.idForLogging()} had no first attachment with path`
        );
      }

      const absolutePath = getAbsoluteAttachmentPath(firstAttachment.path);
      const tempPath = await copyIntoTempDirectory(absolutePath);
      const tempAttachment = {
        ...firstAttachment,
        path: tempPath,
      };

      await message.markViewed();

      const closeLightbox = async () => {
        if (!this.lightboxView) {
          return;
        }

        const { lightboxView } = this;
        this.lightboxView = null;

        this.stopListening(message);
        Signal.Backbone.Views.Lightbox.hide();
        lightboxView.remove();

        await deleteTempFile(tempPath);
      };
      this.listenTo(message, 'expired', closeLightbox);
      this.listenTo(message, 'change', () => {
        if (this.lightBoxView) {
          this.lightBoxView.update(getProps());
        }
      });

      const getProps = () => {
        const { path, contentType } = tempAttachment;

        return {
          objectURL: getAbsoluteTempPath(path),
          contentType,
          onSave: null, // important so download button is omitted
          isViewOnce: true,
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

      if (!message.isNormalBubble()) {
        return;
      }

      const onClose = () => {
        this.stopListening(message, 'change', update);
        this.resetPanel();
      };

      const props = message.getPropsForMessageDetail();
      const view = new Whisper.ReactWrapperView({
        className: 'panel message-detail-wrapper',
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
          hasSignalAccount: Boolean(signalAccount),
          onSendMessage: () => {
            if (signalAccount) {
              this.openConversation(signalAccount);
            }
          },
        },
        onClose: () => {
          this.resetPanel();
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

      if (this.panels.length === 0) {
        this.previousFocus = document.activeElement;
      }

      this.panels.unshift(view);
      view.$el.insertAfter(this.$('.panel').last());
      view.$el.one('animationend', () => {
        view.$el.addClass('panel--static');
      });
    },
    resetPanel() {
      if (!this.panels || !this.panels.length) {
        return;
      }

      const view = this.panels.shift();

      if (
        this.panels.length === 0 &&
        this.previousFocus &&
        this.previousFocus.focus
      ) {
        this.previousFocus.focus();
        this.previousFocus = null;
      }

      if (this.panels.length > 0) {
        this.panels[0].$el.fadeIn(250);
      }
      this.updateHeader();

      view.$el.addClass('panel--remove').one('transitionend', () => {
        view.remove();

        if (this.panels.length === 0) {
          // Make sure poppers are positioned properly
          window.dispatchEvent(new Event('resize'));
        }
      });
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
          this.model.trigger('unload', 'delete messages');
          await this.model.destroyMessages();
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
      const model = messageId
        ? await getMessageById(messageId, {
            Message: Whisper.Message,
          })
        : null;

      if (model && !model.isNormalBubble()) {
        return;
      }

      this.quote = null;
      this.quotedMessage = null;
      this.quoteHolder = null;

      const existing = this.model.get('quotedMessageId');
      if (existing !== messageId) {
        this.model.set({
          quotedMessageId: messageId,
          draftChanged: true,
        });

        await this.saveModel();
      }

      if (this.quoteView) {
        this.quoteView.remove();
        this.quoteView = null;
      }

      if (model) {
        const message = MessageController.register(model.id, model);
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
        return;
      }

      const message = new Whisper.Message({
        conversationId: this.model.id,
        quote: this.quote,
      });
      message.quotedMessage = this.quotedMessage;
      this.quoteHolder = message;

      const props = message.getPropsForQuote();

      this.listenTo(message, 'scroll-to-message', () => {
        this.scrollToMessage(message.quotedMessage.id);
      });

      const contact = this.quotedMessage.getContact();
      if (contact) {
        this.listenTo(contact, 'change', this.renderQuotedMesage);
      }

      this.quoteView = new Whisper.ReactWrapperView({
        className: 'quote-wrapper',
        Component: window.Signal.Components.Quote,
        elCallback: el =>
          this.$(this.compositionApi.current.attSlotRef.current).prepend(el),
        props: Object.assign({}, props, {
          withContentAbove: true,
          onClose: () => {
            // This can't be the normal 'onClose' because that is always run when this
            //   view is removed from the DOM, and would clear the draft quote.
            this.setQuoteMessage(null);
          },
        }),
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

      this.model.clearTypingTimers();

      let ToastView;
      if (extension.expired()) {
        ToastView = Whisper.ExpiredToast;
      }
      if (this.model.isPrivate() && storage.isBlocked(this.model.id)) {
        ToastView = Whisper.BlockedToast;
      }
      if (!this.model.isPrivate() && storage.isGroupBlocked(this.model.id)) {
        ToastView = Whisper.BlockedGroupToast;
      }
      if (!this.model.isPrivate() && this.model.get('left')) {
        ToastView = Whisper.LeftGroupToast;
      }
      if (message.length > MAX_MESSAGE_BODY_LENGTH) {
        ToastView = Whisper.MessageBodyTooLongToast;
      }

      if (ToastView) {
        this.showToast(ToastView);
        this.focusMessageFieldAndClearDisabled();
        return;
      }

      try {
        if (!message.length && !this.hasFiles() && !this.voiceNoteAttachment) {
          return;
        }

        const attachments = await this.getFiles();
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
        this.clearAttachments();
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
      this.debouncedSaveDraft(messageText);
      this.debouncedMaybeGrabLinkPreview(messageText, caretLocation);
    },

    async saveDraft(messageText) {
      const trimmed =
        messageText && messageText.length > 0 ? messageText.trim() : '';

      if (this.model.get('draft') && (!messageText || trimmed.length === 0)) {
        this.model.set({
          draft: null,
          draftChanged: true,
        });
        await this.saveModel();

        return;
      }

      if (messageText !== this.model.get('draft')) {
        this.model.set({
          draft: messageText,
          draftChanged: true,
        });
        await this.saveModel();
      }
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
      if (this.hasFiles()) {
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

          const chunked = await this.makeChunkedRequest(imageUrl);

          // Ensure that this file is either small enough or is resized to meet our
          //   requirements for attachments
          const withBlob = await this.autoScale({
            contentType: chunked.contentType,
            file: new Blob([chunked.data], {
              type: chunked.contentType,
            }),
          });

          const data = await this.arrayBufferFromFile(withBlob.file);
          objectUrl = URL.createObjectURL(withBlob.file);

          const dimensions = await Signal.Types.VisualAttachment.getImageDimensions(
            {
              objectUrl,
              logger: window.log,
            }
          );

          image = {
            data,
            size: data.byteLength,
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
        elCallback: el =>
          this.$(this.compositionApi.current.attSlotRef.current).prepend(el),
        props,
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
  });
})();
