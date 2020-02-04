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
  Signal
*/

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.ConversationStack = Whisper.View.extend({
    className: 'conversation-stack',
    open(conversation) {
      const id = `conversation-${conversation.cid}`;
      const container = $('#main-view .conversation-stack');

      // Has been opened since app start, but not focussed
      const conversationExists = container.children(`#${id}`).length > 0;
      // Is focussed
      const conversationOpened = container.children().first().id === id;

      // To limit the size of the DOM for speed
      const maxNumConversations = 10;
      const numConversations = container
        .children()
        .not('.conversation.placeholder').length;
      const shouldTrimConversations = numConversations > maxNumConversations;

      if (shouldTrimConversations) {
        // Removes conversation which has been hidden the longest
        container.children()[numConversations - 1].remove();
      }

      if (conversationExists) {
        // User opened conversation, move it to top of stack, rather than re-rendering
        const conversations = container
          .children()
          .not('.conversation.placeholder');
        container
          .children(`#${id}`)
          .first()
          .insertBefore(conversations.first());
        conversation.trigger('opened');

        return;
      }

      if (!conversationOpened) {
        this.$el
          .first()
          .find('video, audio')
          .each(function pauseMedia() {
            this.pause();
          });
        let $el = this.$(`#${id}`);
        if ($el === null || $el.length === 0) {
          const view = new Whisper.ConversationView({
            model: conversation,
            window: this.model.window,
          });
          view.view.resetScrollPosition();

          // eslint-disable-next-line prefer-destructuring
          $el = view.$el;
        }

        container.prepend($el);
      }
      conversation.trigger('opened');
    },
    close(conversation) {
      const $el = $(`#conversation-${conversation.cid}`);
      if ($el && $el.length > 0) {
        $el.remove();
      }
    },
    showToast({ message }) {
      window.pushToast({
        title: message,
        type: 'success',
      });
    },
    showConfirmationDialog({ title, message, onOk, onCancel }) {
      window.confirmationDialog({
        title,
        message,
        resolve: onOk,
        reject: onCancel,
      });
    },
  });

  Whisper.AppLoadingScreen = Whisper.View.extend({
    templateName: 'app-loading-screen',
    className: 'app-loading-screen',
    updateProgress() {},
    render_attributes: {
      message: i18n('loading'),
    },
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

      if (!window.storage.get('betaReleaseDisclaimerAccepted')) {
        // Beta disclaimer disabled.
        // this.showBetaReleaseDisclaimer();
      }

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
      this.updateInboxSectionUnread();
      this.setupLeftPane();
    },
    render_attributes: {
      welcomeToSession: i18n('welcomeToSession'),
      selectAContact: i18n('selectAContact'),
    },
    events: {
      click: 'onClick',
      'click .section-toggle': 'toggleSection',
    },
    setupLeftPane() {
      // Here we set up a full redux store with initial state for our LeftPane Root
      const convoCollection = getConversations();
      const conversations = convoCollection.map(
        conversation => conversation.cachedProps
      );

      const initialState = {
        conversations: {
          conversationLookup: Signal.Util.makeLookup(conversations, 'id'),
        },
        user: {
          regionCode: window.storage.get('regionCode'),
          ourNumber:
            window.storage.get('primaryDevicePubKey') ||
            textsecure.storage.user.getNumber(),
          isSecondaryDevice: !!window.storage.get('isSecondaryDevice'),
          i18n: window.i18n,
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

      Whisper.events.on('messageExpired', messageExpired);
      Whisper.events.on('userChanged', userChanged);

      // Finally, add it to the DOM
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
    toggleSection(e) {
      // Expand or collapse this panel
      const $target = this.$(e.currentTarget);
      const $next = $target.next();

      // Toggle section visibility
      $next.slideToggle('fast');
      $target.toggleClass('section-toggle-visible');
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
      this.focusConversation();
    },
    closeConversation(conversation) {
      if (conversation) {
        this.inboxListView.removeItem(conversation);
        this.conversation_stack.close(conversation);
      }
    },
    closeRecording(e) {
      if (e && this.$(e.target).closest('.capture-audio').length > 0) {
        return;
      }
      this.$('.conversation:first .recorder').trigger('close');
    },
    updateInboxSectionUnread() {
      // FIXME: Fix this for new react views
      // const $section = this.$('.section-conversations-unread-counter');
      // const models =
      //   (this.inboxListView.collection &&
      //     this.inboxListView.collection.models) ||
      //   [];
      // const unreadCount = models.reduce(
      //   (count, m) => count + Math.max(0, m.get('unreadCount')),
      //   0
      // );
      // $section.text(unreadCount);
      // if (unreadCount > 0) {
      //   $section.show();
      // } else {
      //   $section.hide();
      // }
    },
    onClick(e) {
      this.closeRecording(e);
    },
    showToastMessageInGutter(message) {
      const toast = new Whisper.MessageToastView({
        message,
      });
      toast.$el.appendTo(this.$('.gutter'));
      toast.render();
    },
    showBetaReleaseDisclaimer() {
      const dialog = new Whisper.BetaReleaseDisclaimer();
      this.el.append(dialog.el);
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
