/* global Backbone, i18n, Whisper, storage, _, $ */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.AppView = Backbone.View.extend({
    initialize() {
      this.inboxView = null;

      this.applyTheme();
      this.applyRtl();
      this.applyHideMenu();
    },
    events: {
      openInbox: 'openInbox',
    },
    applyRtl() {
      const rtlLocales = ['fa', 'ar', 'he'];

      const loc = window.i18n.getLocale();
      if (rtlLocales.includes(loc)) {
        this.$el.addClass('rtl');
      }
    },
    applyTheme() {
      const theme = storage.get('theme-setting') || 'light';
      this.$el
        .removeClass('light-theme')
        .removeClass('dark-theme')
        .addClass(`${theme}-theme`);
    },
    applyHideMenu() {
      const hideMenuBar = storage.get('hide-menu-bar', true);
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

      this.openView(this.importView);
    },
    closeImporter() {
      if (this.importView) {
        this.importView.remove();
        this.importView = null;
      }
    },
    openStandalone() {
      window.addSetupMenuItems();
      this.resetViews();
      this.standaloneView = new Whisper.SessionRegistrationView();
      this.openView(this.standaloneView);
    },
    closeStandalone() {
      if (this.standaloneView) {
        this.standaloneView.remove();
        this.standaloneView = null;
      }
    },
    resetViews() {
      this.closeImporter();
      this.closeStandalone();
    },
    openInbox(options = {}) {
      _.defaults(options, { initialLoadComplete: this.initialLoadComplete });

      if (!this.inboxView) {
        // We create the inbox immediately so we don't miss an update to
        //   this.initialLoadComplete between the start of this method and the
        //   creation of inboxView.
        this.inboxView = new Whisper.InboxView({
          window,
          initialLoadComplete: options.initialLoadComplete,
        });
        return window
          .getConversationController()
          .loadPromise()
          .then(() => {
            this.openView(this.inboxView);
          });
      }
      if (!$.contains(this.el, this.inboxView.el)) {
        this.openView(this.inboxView);
      }
      window.focus(); // FIXME
      return Promise.resolve();
    },
    showResetSessionIdDialog() {
      const theme = this.getThemeObject();
      const resetSessionIDDialog = new Whisper.SessionIDResetDialog({ theme });

      this.el.prepend(resetSessionIDDialog.el);
    },
    getThemeObject() {
      const themeSettings = storage.get('theme-setting') || 'light';
      const theme = themeSettings === 'light' ? window.lightTheme : window.darkTheme;
      return theme;
    },
  });
})();
