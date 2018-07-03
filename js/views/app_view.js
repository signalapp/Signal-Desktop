(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.AppView = Backbone.View.extend({
    initialize: function(options) {
      this.inboxView = null;
      this.installView = null;

      this.applyTheme();
      this.applyHideMenu();
    },
    events: {
      'click .openInstaller': 'openInstaller', // NetworkStatusView has this button
      openInbox: 'openInbox',
    },
    applyTheme: function() {
      var theme = storage.get('theme-setting') || 'android';
      this.$el
        .removeClass('ios')
        .removeClass('android-dark')
        .removeClass('android')
        .addClass(theme);
    },
    applyHideMenu: function() {
      var hideMenuBar = storage.get('hide-menu-bar', false);
      window.setAutoHideMenuBar(hideMenuBar);
      window.setMenuBarVisibility(!hideMenuBar);
    },
    openView: function(view) {
      this.el.innerHTML = '';
      this.el.append(view.el);
      this.delegateEvents();
    },
    openDebugLog: function() {
      this.closeDebugLog();
      this.debugLogView = new Whisper.DebugLogView();
      this.debugLogView.$el.appendTo(this.el);
    },
    closeDebugLog: function() {
      if (this.debugLogView) {
        this.debugLogView.remove();
        this.debugLogView = null;
      }
    },
    openImporter: function() {
      window.addSetupMenuItems();
      this.resetViews();
      var importView = (this.importView = new Whisper.ImportView());
      this.listenTo(
        importView,
        'light-import',
        this.finishLightImport.bind(this)
      );
      this.openView(this.importView);
    },
    finishLightImport: function() {
      var options = {
        hasExistingData: true,
      };
      this.openInstaller(options);
    },
    closeImporter: function() {
      if (this.importView) {
        this.importView.remove();
        this.importView = null;
      }
    },
    openInstaller: function(options) {
      options = options || {};

      // If we're in the middle of import, we don't want to show the menu options
      //   allowing the user to switch to other ways to set up the app. If they
      //   switched back and forth in the middle of a light import, they'd lose all
      //   that imported data.
      if (!options.hasExistingData) {
        window.addSetupMenuItems();
      }

      this.resetViews();
      var installView = (this.installView = new Whisper.InstallView(options));
      this.openView(this.installView);
    },
    closeInstaller: function() {
      if (this.installView) {
        this.installView.remove();
        this.installView = null;
      }
    },
    openStandalone: function() {
      if (window.getEnvironment() !== 'production') {
        window.addSetupMenuItems();
        this.resetViews();
        this.standaloneView = new Whisper.StandaloneRegistrationView();
        this.openView(this.standaloneView);
      }
    },
    closeStandalone: function() {
      if (this.standaloneView) {
        this.standaloneView.remove();
        this.standaloneView = null;
      }
    },
    resetViews: function() {
      this.closeInstaller();
      this.closeImporter();
      this.closeStandalone();
    },
    openInbox: function(options) {
      options = options || {};
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

      console.log('open inbox');
      this.closeInstaller();

      if (!this.inboxView) {
        // We create the inbox immediately so we don't miss an update to
        //   this.initialLoadComplete between the start of this method and the
        //   creation of inboxView.
        this.inboxView = new Whisper.InboxView({
          model: self,
          window: window,
          initialLoadComplete: options.initialLoadComplete,
        });
        return ConversationController.loadPromise().then(
          function() {
            this.openView(this.inboxView);
          }.bind(this)
        );
      } else {
        if (!$.contains(this.el, this.inboxView.el)) {
          this.openView(this.inboxView);
        }
        window.focus(); // FIXME
        return Promise.resolve();
      }
    },
    onEmpty: function() {
      var view = this.inboxView;

      this.initialLoadComplete = true;
      if (view) {
        view.onEmpty();
      }
    },
    onProgress: function(count) {
      var view = this.inboxView;
      if (view) {
        view.onProgress(count);
      }
    },
    openConversation: function(conversation) {
      if (conversation) {
        this.openInbox().then(
          function() {
            this.inboxView.openConversation(null, conversation);
          }.bind(this)
        );
      }
    },
  });
})();
