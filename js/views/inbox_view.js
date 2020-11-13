/*
  global
  $
  ConversationController,
  extension,
  ConversationController
  getConversations,
  getInboxCollection,
  i18n,
  Whisper,
  textsecure,
  Signal,
*/

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.AppLoadingScreen = Whisper.View.extend({
    templateName: 'app-loading-screen',
    className: 'app-loading-screen',
  });

  Whisper.InboxViewWhisper = Whisper.View.extend({
    templateName: 'two-column',
    className: 'inbox index',
    initialize(options = {}) {
      this.ready = false;
      this.render();
      this.$el.attr('tabindex', '1');

      if (!options.initialLoadComplete) {
        this.appLoadingScreen = new Whisper.AppLoadingScreen();
        this.appLoadingScreen.render();
        this.appLoadingScreen.$el.prependTo(this.el);
        this.startConnectionListener();
      }

      // Inbox
      const inboxCollection = getInboxCollection();

      // ConversationCollection
      this.listenTo(inboxCollection, 'messageError', () => {
        if (this.networkStatusView) {
          this.networkStatusView.render();
        }
      });

      this.networkStatusView = new Whisper.NetworkStatusView();
      this.$el
        .find('.network-status-container')
        .append(this.networkStatusView.render().el);

      extension.expired(expired => {
        if (expired) {
          const banner = new Whisper.ExpiredAlertBanner().render();
          banner.$el.prependTo(this.$el);
          this.$el.addClass('expired');
        }
      });

      this.openSettings = this.openSettings.bind(this);
      this.openSessionConversation = this.openSessionConversation.bind(this);
      // FIXME: Fix this for new react views
      this.setupLeftPane();
    },




    startConnectionListener() {
      this.interval = setInterval(() => {
        const status = window.getSocketStatus();
        switch (status) {
          case WebSocket.CONNECTING:
            break;
          case WebSocket.OPEN:
            clearInterval(this.interval);
            // Default to connected, but lokinet is slow so we pretend empty event
            this.onEmpty();
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
            // We also replicate empty here
            this.onEmpty();
            break;
        }
      }, 1000);
    },
    onEmpty() {
      const view = this.appLoadingScreen;
      if (view) {
        this.appLoadingScreen = null;
        view.remove();
      }
    },
    async openConversation(id, messageId) {
      // If we call this to create a new conversation, it can only be private
      // (group conversations are created elsewhere)
      const conversation = await ConversationController.getOrCreateAndWait(
        id,
        'private'
      );

      if (this.openConversationAction) {
        this.openConversationAction(id, messageId);
      }

      if (conversation) {
        conversation.updateProfileName();
      }

      this.open(conversation);
    },
  });

  Whisper.ExpiredAlertBanner = Whisper.View.extend({
    templateName: 'expired_alert',
    className: 'expiredAlert',
    render_attributes() {
      return {
        expiredWarning: i18n('expiredWarning'),
        upgrade: i18n('upgrade'),
      };
    },
  });
})();
