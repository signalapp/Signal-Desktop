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

      this.showSeedDialog = this.showSeedDialog.bind(this);
      this.showPasswordDialog = this.showPasswordDialog.bind(this);
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
    showEditProfileDialog(options) {
      // eslint-disable-next-line no-param-reassign
      options.theme = this.getThemeObject();
      const dialog = new Whisper.EditProfileDialogView(options);
      this.el.prepend(dialog.el);
    },
    showResetSessionIdDialog() {
      const theme = this.getThemeObject();
      const resetSessionIDDialog = new Whisper.SessionIDResetDialog({ theme });

      this.el.prepend(resetSessionIDDialog.el);
    },
    showUserDetailsDialog(options) {
      // eslint-disable-next-line no-param-reassign
      options.theme = this.getThemeObject();
      const dialog = new Whisper.UserDetailsDialogView(options);
      this.el.prepend(dialog.el);
    },
    showNicknameDialog({ pubKey, title, message, nickname, onOk, onCancel }) {
      const _title = title || `Change nickname for ${pubKey}`;

      const dialog = new Whisper.NicknameDialogView({
        title: _title,
        message,
        name: nickname,
        resolve: onOk,
        reject: onCancel,
        theme: this.getThemeObject(),
      });
      this.el.prepend(dialog.el);
      dialog.focusInput();
    },
    showPasswordDialog(options) {
      // eslint-disable-next-line no-param-reassign
      options.theme = this.getThemeObject();
      const dialog = new Whisper.PasswordDialogView(options);
      this.el.prepend(dialog.el);
    },
    showSeedDialog() {
      const dialog = new Whisper.SeedDialogView({
        theme: this.getThemeObject(),
      });
      this.el.prepend(dialog.el);
    },
    getThemeObject() {
      const themeSettings = storage.get('theme-setting') || 'light';
      const theme =
        themeSettings === 'light' ? window.lightTheme : window.darkTheme;
      return theme;
    },
    showUpdateGroupNameDialog(groupConvo) {
      // eslint-disable-next-line no-param-reassign
      groupConvo.theme = this.getThemeObject();

      const dialog = new Whisper.UpdateGroupNameDialogView(groupConvo);
      this.el.append(dialog.el);
    },
    showUpdateGroupMembersDialog(groupConvo) {
      // eslint-disable-next-line no-param-reassign
      groupConvo.theme = this.getThemeObject();

      const dialog = new Whisper.UpdateGroupMembersDialogView(groupConvo);
      this.el.append(dialog.el);
    },
    showLeaveGroupDialog(groupConvo) {
      if (!groupConvo.isGroup()) {
        throw new Error(
          'showLeaveGroupDialog() called with a non group convo.'
        );
      }

      const title = i18n('leaveGroup');
      const message = i18n('leaveGroupConfirmation');
      const ourPK = window.textsecure.storage.user.getNumber();
      const isAdmin = (groupConvo.get('groupAdmins') || []).includes(ourPK);
      const isClosedGroup = groupConvo.get('is_medium_group') || false;

      // if this is not a closed group, or we are not admin, we can just show a confirmation dialog
      if (!isClosedGroup || (isClosedGroup && !isAdmin)) {
        window.confirmationDialog({
          title,
          message,
          resolve: () => groupConvo.leaveGroup(),
          theme: this.getThemeObject(),
        });
      } else {
        // we are the admin on a closed group. We have to warn the user about the group Deletion
        this.showAdminLeaveClosedGroupDialog(groupConvo);
      }
    },
    showInviteContactsDialog(groupConvo) {
      // eslint-disable-next-line no-param-reassign
      groupConvo.theme = this.getThemeObject();
      const dialog = new Whisper.InviteContactsDialogView(groupConvo);
      this.el.append(dialog.el);
    },

    showAdminLeaveClosedGroupDialog(groupConvo) {
      // eslint-disable-next-line no-param-reassign
      groupConvo.theme = this.getThemeObject();
      const dialog = new Whisper.AdminLeaveClosedGroupDialog(groupConvo);
      this.el.append(dialog.el);
    },
    showAddModeratorsDialog(groupConvo) {
      // eslint-disable-next-line no-param-reassign
      groupConvo.theme = this.getThemeObject();
      const dialog = new Whisper.AddModeratorsDialogView(groupConvo);
      this.el.append(dialog.el);
    },
    showRemoveModeratorsDialog(groupConvo) {
      // eslint-disable-next-line no-param-reassign
      groupConvo.theme = this.getThemeObject();
      const dialog = new Whisper.RemoveModeratorsDialogView(groupConvo);
      this.el.append(dialog.el);
    },
  });
})();
