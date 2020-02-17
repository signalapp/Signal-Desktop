/* global Backbone, i18n, Whisper, storage, _, ConversationController, $ */

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

      this.showSeedDialog = this.showSeedDialog.bind(this);
      this.showPasswordDialog = this.showPasswordDialog.bind(this);
    },
    events: {
      'click .openInstaller': 'openInstaller', // NetworkStatusView has this button
      openInbox: 'openInbox',
    },
    applyTheme() {
      const iOS = storage.get('userAgent') === 'OWI';
      const theme = 'dark'; // storage.get('theme-setting') || 'dark';
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
      //   - background.js has X number of openInbox() calls,
      //      and passes initalLoadComplete directly via the options parameter.
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
    openConversation(id, messageId) {
      if (id) {
        this.openInbox().then(() => {
          this.inboxView.openConversation(id, messageId);
        });
      }
    },
    showEditProfileDialog(options) {
      const dialog = new Whisper.EditProfileDialogView(options);
      this.el.prepend(dialog.el);
    },
    showUserDetailsDialog(options) {
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
      });
      this.el.prepend(dialog.el);
      dialog.focusInput();
    },
    showPasswordDialog(options) {
      const dialog = new Whisper.PasswordDialogView(options);
      this.el.prepend(dialog.el);
    },
    showSeedDialog() {
      const dialog = new Whisper.SeedDialogView();
      this.el.prepend(dialog.el);
    },
    showQRDialog(string) {
      const dialog = new Whisper.QRDialogView({
        value: string,
      });
      this.el.append(dialog.el);
    },
    showDevicePairingDialog(options) {
      const dialog = new Whisper.DevicePairingDialogView(options);
      this.el.prepend(dialog.el);
    },
    showDevicePairingWordsDialog() {
      const dialog = new Whisper.DevicePairingWordsDialogView();
      this.el.prepend(dialog.el);
    },
    showCreateGroup() {
      // TODO: make it impossible to open 2 dialogs as once
      // Currently, if the button is in focus, it is possible to
      // create a new dialog by pressing 'Enter'
      const dialog = new Whisper.CreateGroupDialogView();
      this.el.append(dialog.el);
    },
    showUpdateGroupNameDialog(groupConvo) {
      const dialog = new Whisper.UpdateGroupNameDialogView(groupConvo);
      this.el.append(dialog.el);
    },
    showUpdateGroupMembersDialog(groupConvo) {
      const dialog = new Whisper.UpdateGroupMembersDialogView(groupConvo);
      this.el.append(dialog.el);
    },

    showSessionRestoreConfirmation(options) {
      const dialog = new Whisper.ConfirmSessionResetView(options);
      this.el.append(dialog.el);
    },
    showLeaveGroupDialog(groupConvo) {
      let title = i18n('deleteContact');
      let message = i18n('deleteContactConfirmation');

      if (groupConvo.isPublic()) {
        title = i18n('deletePublicChannel');
        message = i18n('deletePublicChannelConfirmation');
      } else if (groupConvo.isClosedGroup()) {
        title = i18n('leaveClosedGroup');
        message = i18n('leaveClosedGroupConfirmation');
      }

      window.confirmationDialog({
        title,
        message,
        resolve: () => ConversationController.deleteContact(groupConvo.id),
      });
    },
    showInviteFriendsDialog(groupConvo) {
      const dialog = new Whisper.InviteFriendsDialogView(groupConvo);
      this.el.append(dialog.el);
    },
    showAddModeratorsDialog(groupConvo) {
      const dialog = new Whisper.AddModeratorsDialogView(groupConvo);
      this.el.append(dialog.el);
    },
    showRemoveModeratorsDialog(groupConvo) {
      const dialog = new Whisper.RemoveModeratorsDialogView(groupConvo);
      this.el.append(dialog.el);
    },
  });
})();
