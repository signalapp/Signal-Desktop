/* global i18n, Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.EditProfileDialogView = Whisper.View.extend({
    className: 'loki-dialog modal',
    initialize({
      profileName,
      avatarPath,
      avatarColor,
      pubkey,
      onOk,
      callback,
    }) {
      this.close = this.close.bind(this);

      this.callback = callback;
      this.profileName = profileName;
      this.pubkey = pubkey;
      this.avatarPath = avatarPath;
      this.avatarColor = avatarColor;
      this.onOk = onOk;

      this.$el.focus();
      this.render();
    },
    render() {
      this.dialogView = new Whisper.ReactWrapperView({
        className: 'edit-profile-dialog',
        Component: window.Signal.Components.EditProfileDialog,
        props: {
          callback: this.callback,
          onOk: this.onOk,
          onClose: this.close,
          profileName: this.profileName,
          pubkey: this.pubkey,
          avatarPath: this.avatarPath,
          i18n,
        },
      });

      this.$el.append(this.dialogView.el);
      return this;
    },
    close() {
      this.remove();
    },
  });
})();
