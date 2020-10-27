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

  Whisper.ConversationStack = Whisper.View.extend({
    className: 'conversation-stack',
    open(conversation) {
      // const container = $('#main-view .conversation-stack');
      // container.html('');

      this.setupSessionConversation(conversation.id);
      // const sessionConversationView = new Whisper.SessionConversationView({
      //   el: container,
      //   conversationKey: conversation.id,
      // });
      // sessionConversationView.render();

      conversation.trigger('opened');
    },
    close(conversation) {
      const $el = $(`#conversation-${conversation.cid}`);
      if ($el && $el.length > 0) {
        $el.remove();
      }
    },
    showConfirmationDialog({
      title,
      message,
      messageSub,
      onOk,
      onCancel,
      hideCancel,
    }) {
      window.confirmationDialog({
        title,
        message,
        resolve: onOk,
        reject: onCancel,
        hideCancel,
        messageSub,
      });
    },
    setupSessionConversation() {
      // Here we set up a full redux store with initial state for our Conversation Root

      this.sessionConversationView = new Whisper.ReactWrapperView({
        JSX: Signal.State.Roots.createSessionConversation(window.inboxStore),
        className: 'conversation-item',
      });

      // Add sessionConversation to the DOM
      $('#main-view .conversation-stack').html('');
      $('#main-view .conversation-stack').append(
        this.sessionConversationView.el
      );
    },
  });

  Whisper.AppLoadingScreen = Whisper.View.extend({
    templateName: 'app-loading-screen',
    className: 'app-loading-screen',
  });

  Whisper.InboxView = Whisper.View.extend({
    templateName: 'two-column',
    className: 'inbox index',
    initialize(options = {}) {
      this.ready = false;
      this.render();
      this.$el.attr('tabindex', '1');

      this.conversation_stack = new Whisper.ConversationStack({
        el: this.$('.conversation-stack'),
        model: { window: options.window },
      });

      if (!options.initialLoadComplete) {
        this.appLoadingScreen = new Whisper.AppLoadingScreen();
        this.appLoadingScreen.render();
        this.appLoadingScreen.$el.prependTo(this.el);
        this.startConnectionListener();
      }

      // Inbox
      const inboxCollection = getInboxCollection();

      // ConversationCollection
      const conversations = getConversations();
      this.listenTo(conversations, 'remove', conversation => {
        if (this.conversation_stack) {
          this.conversation_stack.close(conversation);
        }
      });

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

      // FIXME: Fix this for new react views
      this.setupLeftPane();
    },
    async setupLeftPane() {
      // Here we set up a full redux store with initial state for our LeftPane Root
      const convoCollection = getConversations();
      const conversations = convoCollection.map(
        conversation => conversation.cachedProps
      );

      const filledConversations = conversations.map(async conv => {
        const messages = await window.getMessagesByKey(conv.id);
        return { ...conv, messages };
      });

      const fullFilledConversations = await Promise.all(filledConversations);

      const initialState = {
        conversations: {
          conversationLookup: Signal.Util.makeLookup(
            fullFilledConversations,
            'id'
          ),
        },
        user: {
          regionCode: window.storage.get('regionCode'),
          ourNumber:
            window.storage.get('primaryDevicePubKey') ||
            textsecure.storage.user.getNumber(),
          isSecondaryDevice: !!window.storage.get('isSecondaryDevice'),
          i18n: window.i18n,
        },
        section: {
          focusedSection: 1,
        },
      };

      this.store = Signal.State.createStore(initialState);
      window.inboxStore = this.store;
      this.leftPaneView = new Whisper.ReactWrapperView({
        JSX: Signal.State.Roots.createLeftPane(this.store),
        className: 'left-pane-wrapper',
      });

      // Enables our redux store to be updated by backbone events in the outside world
      const {
        conversationAdded,
        conversationChanged,
        conversationRemoved,
        removeAllConversations,
        messageExpired,
        openConversationExternal,
      } = Signal.State.bindActionCreators(
        Signal.State.Ducks.conversations.actions,
        this.store.dispatch
      );
      const { userChanged } = Signal.State.bindActionCreators(
        Signal.State.Ducks.user.actions,
        this.store.dispatch
      );

      this.openConversationAction = openConversationExternal;

      // In the future this listener will be added by the conversation view itself. But
      //   because we currently have multiple converations open at once, we install just
      //   one global handler.
      // $(document).on('keydown', event => {
      //   const { ctrlKey, key } = event;

      // We can add Command-E as the Mac shortcut when we add it to our Electron menus:
      //   https://stackoverflow.com/questions/27380018/when-cmd-key-is-kept-pressed-keyup-is-not-triggered-for-any-other-key
      // For now, it will stay as CTRL-E only
      //   if (key === 'e' && ctrlKey) {
      //     const state = this.store.getState();
      //     const selectedId = state.conversations.selectedConversation;
      //     const conversation = ConversationController.get(selectedId);

      //     if (conversation && !conversation.get('isArchived')) {
      //       conversation.setArchived(true);
      //       conversation.trigger('unload');
      //     }
      //   }
      // });
      this.fetchHandleMessageSentData = this.fetchHandleMessageSentData.bind(
        this
      );
      this.handleMessageSentFailure = this.handleMessageSentFailure.bind(this);
      this.handleMessageSentSuccess = this.handleMessageSentSuccess.bind(this);

      this.listenTo(convoCollection, 'remove', conversation => {
        const { id } = conversation || {};
        conversationRemoved(id);
      });
      this.listenTo(convoCollection, 'add', conversation => {
        const { id, cachedProps } = conversation || {};
        conversationAdded(id, cachedProps);
      });
      this.listenTo(convoCollection, 'change', conversation => {
        const { id, cachedProps } = conversation || {};
        conversationChanged(id, cachedProps);
      });
      this.listenTo(convoCollection, 'reset', removeAllConversations);

      window.libsession
        .getMessageQueue()
        .events.addListener('success', this.handleMessageSentSuccess);

      window.libsession
        .getMessageQueue()
        .events.addListener('fail', this.handleMessageSentFailure);

      Whisper.events.on('messageExpired', messageExpired);
      Whisper.events.on('userChanged', userChanged);

      // Finally, add it to the DOM
      this.$('.left-pane-placeholder').append(this.leftPaneView.el);
    },

    async fetchHandleMessageSentData(m) {
      // nobody is listening to this freshly fetched message .trigger calls
      const tmpMsg = await window.Signal.Data.getMessageById(m.identifier, {
        Message: Whisper.Message,
      });

      if (!tmpMsg) {
        return null;
      }

      // find the corresponding conversation of this message
      const conv = window.ConversationController.get(
        tmpMsg.get('conversationId')
      );

      // then, find in this conversation the very same message
      const msg = conv.messageCollection.models.find(
        convMsg => convMsg.id === tmpMsg.id
      );

      if (!msg) {
        return null;
      }

      return { msg };
    },

    async handleMessageSentSuccess(sentMessage, wrappedEnvelope) {
      const fetchedData = await this.fetchHandleMessageSentData(sentMessage);
      if (!fetchedData) {
        return;
      }
      const { msg } = fetchedData;

      msg.handleMessageSentSuccess(sentMessage, wrappedEnvelope);
    },

    async handleMessageSentFailure(sentMessage, error) {
      const fetchedData = await this.fetchHandleMessageSentData(sentMessage);
      if (!fetchedData) {
        return;
      }
      const { msg } = fetchedData;

      await msg.handleMessageSentFailure(sentMessage, error);
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
    onProgress() {},
    reloadBackgroundPage() {
      window.location.reload();
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

      this.conversation_stack.open(conversation);
    },
    closeConversation(conversation) {
      if (conversation) {
        this.inboxListView.removeItem(conversation);
        this.conversation_stack.close(conversation);
      }
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
