/* global i18n, Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.UserDetailsDialogView = Whisper.View.extend({
    className: 'loki-dialog modal',
    initialize({
      profileName,
      avatarPath,
      avatarColor,
      pubkey,
      isRss,
      onOk,
      onStartConversation,
    }) {
      this.close = this.close.bind(this);

      this.profileName = profileName;
      this.pubkey = pubkey;
      this.isRss = isRss;
      this.avatarPath = avatarPath;
      this.avatarColor = avatarColor;
      this.onOk = onOk;
      this.onStartConversation = onStartConversation;

      this.$el.focus();
      this.render();
    },
    render() {
      this.dialogView = new Whisper.ReactWrapperView({
        className: 'user-details-dialog',
        Component: window.Signal.Components.UserDetailsDialog,
        props: {
          onOk: this.onOk,
          onClose: this.close,
          onStartConversation: this.onStartConversation,
          profileName: this.profileName,
          pubkey: this.pubkey,
          isRss: this.isRss,
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
