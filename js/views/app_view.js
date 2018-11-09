/* global Backbone, Whisper, storage, _, ConversationController, $ */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.AppView = Backbone.View.extend({
    initialize() {
      this.inboxView = null;
      this.installView = null;

      this.applyTheme();
      this.applyHideMenu();
    },
    events: {
      'click .openInstaller': 'openInstaller', // NetworkStatusView has this button
      openInbox: 'openInbox',
    },
    applyTheme() {
      const iOS = storage.get('userAgent') === 'OWI';
      const theme = storage.get('theme-setting') || 'light';
      this.$el
        .removeClass('light-theme')
        .removeClass('dark-theme')
        .addClass(`${theme}-theme`);

      if (iOS) {
        this.$el.addClass('ios-theme');
      } else {
        this.$el.removeClass('ios-theme');
      }
    },
    applyHideMenu() {
      const hideMenuBar = storage.get('hide-menu-bar', false);
      window.setAutoHideMenuBar(hideMenuBar);
      window.setMenuBarVisibility(!hideMenuBar);
    },
    openView(view) {
      this.el.innerHTML = '';
      this.el.append(view.el);
      this.delegateEvents();
    },
    openDebugLog() {
      this.closeDebugLog();
      this.debugLogView = new Whisper.DebugLogView();
      this.debugLogView.$el.appendTo(this.el);
    },
    closeDebugLog() {
      if (this.debugLogView) {
        this.debugLogView.remove();
        this.debugLogView = null;
      }
    },
    openImporter() {
      window.addSetupMenuItems();
      this.resetViews();

      const importView = new Whisper.ImportView();
      this.importView = importView;

      this.listenTo(
        importView,
        'light-import',
        this.finishLightImport.bind(this)
      );
      this.openView(this.importView);
    },
    finishLightImport() {
      const options = {
        hasExistingData: true,
      };
      this.openInstaller(options);
    },
    closeImporter() {
      if (this.importView) {
        this.importView.remove();
        this.importView = null;
      }
    },
    openInstaller(options = {}) {
      // If we're in the middle of import, we don't want to show the menu options
      //   allowing the user to switch to other ways to set up the app. If they
      //   switched back and forth in the middle of a light import, they'd lose all
      //   that imported data.
      if (!options.hasExistingData) {
        window.addSetupMenuItems();
      }

      this.resetViews();
      const installView = new Whisper.InstallView(options);
      this.installView = installView;

      this.openView(this.installView);
    },
    closeInstaller() {
      if (this.installView) {
        this.installView.remove();
        this.installView = null;
      }
    },
    openStandalone() {
      if (window.getEnvironment() !== 'production') {
        window.addSetupMenuItems();
        this.resetViews();
        this.standaloneView = new Whisper.StandaloneRegistrationView();
        this.openView(this.standaloneView);
      }
    },
    closeStandalone() {
      if (this.standaloneView) {
        this.standaloneView.remove();
        this.standaloneView = null;
      }
    },
    resetViews() {
      this.closeInstaller();
      this.closeImporter();
      this.closeStandalone();
    },
    openInbox(options = {}) {
      // The inbox can be created before the 'empty' event fires or afterwards. If
      //   before, it's straightforward: the onEmpty() handler below updates the
      //   view directly, and we're in good shape. If we create the inbox late, we
      //   need to be sure that the current value of initialLoadComplete is provided
      //   so its loading screen doesn't stick around forever.

      // Two primary techniques at play for this situation:
      //   - background.js has two openInbox() calls, and passes initalLoadComplete
      //     directly via the options parameter.
      //   - in other situations openInbox() will be called with no options. So this
      //     view keeps track of whether onEmpty() has ever been called with
      //     this.initialLoadComplete. An example of this: on a phone-pairing setup.
      _.defaults(options, { initialLoadComplete: this.initialLoadComplete });

      window.log.info('open inbox');
      this.closeInstaller();

      if (!this.inboxView) {
        // We create the inbox immediately so we don't miss an update to
        //   this.initialLoadComplete between the start of this method and the
        //   creation of inboxView.
        this.inboxView = new Whisper.InboxView({
          window,
          initialLoadComplete: options.initialLoadComplete,
        });
        return ConversationController.loadPromise().then(() => {
          this.openView(this.inboxView);
        });
      }
      if (!$.contains(this.el, this.inboxView.el)) {
        this.openView(this.inboxView);
      }
      window.focus(); // FIXME
      return Promise.resolve();
    },
    onEmpty() {
      const view = this.inboxView;

      this.initialLoadComplete = true;
      if (view) {
        view.onEmpty();
      }
    },
    onProgress(count) {
      const view = this.inboxView;
      if (view) {
        view.onProgress(count);
      }
    },
    openConversation(conversation) {
      if (conversation) {
        this.openInbox().then(() => {
          this.inboxView.openConversation(conversation);
        });
      }
    },
    async showFriendRequest({ pubKey, message }) {
      const controller = window.ConversationController;
      const conversation = await controller.getOrCreateAndWait(pubKey, 'private');
      if (conversation) {
        conversation.addFriendRequest(message, 'incoming');
      }

      this.openConversation(conversation);
    },
  });
})();
