/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.RemoveModeratorsDialogView = Whisper.View.extend({
    className: 'loki-dialog modal',
    async initialize(convo) {
      this.close = this.close.bind(this);
      this.onSubmit = this.onSubmit.bind(this);

      this.chatName = convo.get('name');
      this.chatServer = convo.get('server');
      this.channelId = convo.get('channelId');

      // get current list of moderators
      this.channelAPI = await convo.getPublicSendData();
      const modPubKeys = await this.channelAPI.getModerators();
      const convos = window.getConversationController().getConversations();
      const moderators = modPubKeys
        .map(
          pubKey =>
            convos.find(c => c.id === pubKey) || {
              id: pubKey, // memberList need a key
              authorPhoneNumber: pubKey,
            }
        )
        .filter(c => !!c);

      this.mods = moderators;
      this.theme = convo.theme;

      this.$el.focus();
      this.render();
    },
    render() {
      const view = new Whisper.ReactWrapperView({
        className: 'remove-moderators-dialog',
        Component: window.Signal.Components.RemoveModeratorsDialog,
        props: {
          modList: this.mods,
          onSubmit: this.onSubmit,
          onClose: this.close,
          chatName: this.chatName,
          theme: this.theme,
        },
      });

      this.$el.append(view.el);
      return this;
    },
    close() {
      this.remove();
    },
    async onSubmit(pubKeys) {
      window.log.info(`asked to remove moderators ${pubKeys}`);

      const res = await this.channelAPI.serverAPI.removeModerators(pubKeys);
      if (res !== true) {
        // we have errors, deal with them...
        // how?
        window.log.warn('failed to remove moderators:', res);
      } else {
        window.log.info(`${pubKeys} removed from moderators...`);
      }
    },
  });
})();
