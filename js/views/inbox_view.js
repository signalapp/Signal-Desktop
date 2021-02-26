// Copyright 2014-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global
  ConversationController,
  i18n,
  Whisper,
  Signal,
  $
*/

// eslint-disable-next-line func-names
(function () {
  window.Whisper = window.Whisper || {};

  Whisper.StickerPackInstallFailedToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('stickers--toast--InstallFailed') };
    },
  });

  Whisper.ConversationStack = Whisper.View.extend({
    className: 'conversation-stack',
    lastConversation: null,
    open(conversation, messageId) {
      const id = `conversation-${conversation.cid}`;
      if (id !== this.el.lastChild.id) {
        const view = new Whisper.ConversationView({
          model: conversation,
          window: this.model.window,
        });
        this.listenTo(conversation, 'unload', () =>
          this.onUnload(conversation)
        );
        view.$el.appendTo(this.el);

        if (this.lastConversation && this.lastConversation !== conversation) {
          this.lastConversation.trigger(
            'unload',
            'opened another conversation'
          );
          this.stopListening(this.lastConversation);
          this.lastConversation = null;
        }

        this.lastConversation = conversation;
        conversation.trigger('opened', messageId);
      } else if (messageId) {
        conversation.trigger('scroll-to-message', messageId);
      }

      // Make sure poppers are positioned properly
      window.dispatchEvent(new Event('resize'));
    },
    onUnload(conversation) {
      if (this.lastConversation === conversation) {
        this.stopListening(this.lastConversation);
        this.lastConversation = null;
      }
    },
  });

  Whisper.AppLoadingScreen = Whisper.View.extend({
    template: () => $('#app-loading-screen').html(),
    className: 'app-loading-screen',
    updateProgress(count) {
      if (count > 0) {
        const message = i18n('loadingMessages', [count.toString()]);
        this.$('.message').text(message);
      }
    },
    render_attributes: {
      message: i18n('loading'),
    },
  });

  Whisper.InboxView = Whisper.View.extend({
    template: () => $('#two-column').html(),
    className: 'inbox index',
    initialize(options = {}) {
      this.ready = false;
      this.render();

      this.conversation_stack = new Whisper.ConversationStack({
        el: this.$('.conversation-stack'),
        model: { window: options.window },
      });

      Whisper.events.on('refreshConversation', ({ oldId, newId }) => {
        const convo = this.conversation_stack.lastConversation;
        if (convo && convo.get('id') === oldId) {
          this.conversation_stack.open(newId);
        }
      });

      if (!options.initialLoadComplete) {
        this.appLoadingScreen = new Whisper.AppLoadingScreen();
        this.appLoadingScreen.render();
        this.appLoadingScreen.$el.prependTo(this.el);
        this.startConnectionListener();
      } else {
        this.setupLeftPane();
        this.setupCallManagerUI();
      }

      Whisper.events.on('pack-install-failed', () => {
        const toast = new Whisper.StickerPackInstallFailedToast();
        toast.$el.appendTo(this.$el);
        toast.render();
      });
    },
    render_attributes: {
      welcomeToSignal: i18n('welcomeToSignal'),
      selectAContact: i18n('selectAContact'),
    },
    events: {
      click: 'onClick',
    },
    setupCallManagerUI() {
      if (this.callManagerView) {
        return;
      }
      this.callManagerView = new Whisper.ReactWrapperView({
        className: 'call-manager-wrapper',
        JSX: Signal.State.Roots.createCallManager(window.reduxStore),
      });
      this.$('.call-manager-placeholder').append(this.callManagerView.el);
    },
    setupLeftPane() {
      if (this.leftPaneView) {
        return;
      }
      this.leftPaneView = new Whisper.ReactWrapperView({
        className: 'left-pane-wrapper',
        JSX: Signal.State.Roots.createLeftPane(window.reduxStore),
      });

      this.$('.left-pane-placeholder').append(this.leftPaneView.el);
    },
    startConnectionListener() {
      this.interval = setInterval(() => {
        const status = window.getSocketStatus();
        switch (status) {
          case WebSocket.CONNECTING:
            break;
          case WebSocket.OPEN:
            clearInterval(this.interval);
            // if we've connected, we can wait for real empty event
            this.interval = null;
            break;
          case WebSocket.CLOSING:
          case WebSocket.CLOSED:
            clearInterval(this.interval);
            this.interval = null;
            // if we failed to connect, we pretend we got an empty event
            this.onEmpty();
            break;
          default:
            window.log.warn(
              'startConnectionListener: Found unexpected socket status; calling onEmpty() manually.'
            );
            this.onEmpty();
            break;
        }
      }, 1000);
    },
    onEmpty() {
      this.setupLeftPane();
      this.setupCallManagerUI();

      const view = this.appLoadingScreen;
      if (view) {
        this.appLoadingScreen = null;
        view.remove();

        const searchInput = document.querySelector(
          '.module-main-header__search__input'
        );
        if (searchInput && searchInput.focus) {
          searchInput.focus();
        }
      }
    },
    onProgress(count) {
      const view = this.appLoadingScreen;
      if (view) {
        view.updateProgress(count);
      }
    },
    focusConversation(e) {
      if (e && this.$(e.target).closest('.placeholder').length) {
        return;
      }

      this.$('#header, .gutter').addClass('inactive');
      this.$('.conversation-stack').removeClass('inactive');
    },
    focusHeader() {
      this.$('.conversation-stack').addClass('inactive');
      this.$('#header, .gutter').removeClass('inactive');
      this.$('.conversation:first .menu').trigger('close');
    },
    reloadBackgroundPage() {
      window.location.reload();
    },
    async openConversation(id, messageId) {
      const conversation = await ConversationController.getOrCreateAndWait(
        id,
        'private'
      );

      conversation.setMarkedUnread(false);

      const { openConversationExternal } = window.reduxActions.conversations;
      if (openConversationExternal) {
        openConversationExternal(conversation.id, messageId);
      }

      this.conversation_stack.open(conversation, messageId);
      this.focusConversation();
    },
    closeRecording(e) {
      if (e && this.$(e.target).closest('.capture-audio').length > 0) {
        return;
      }
      this.$('.conversation:first .recorder').trigger('close');
    },
    onClick(e) {
      this.closeRecording(e);
    },
  });
})();
