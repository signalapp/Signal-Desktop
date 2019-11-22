/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.InviteFriendsDialogView = Whisper.View.extend({
    className: 'loki-dialog modal',
    initialize(convo) {
      this.close = this.close.bind(this);
      this.submit = this.submit.bind(this);

      const convos = window.getConversations().models;

      const friends = convos.filter(
        d => !!d && d.isFriend() && d.isPrivate() && !d.isMe()
      );

      this.friends = friends;
      this.chatName = convo.get('name');
      this.chatServer = convo.get('server');

      this.$el.focus();
      this.render();
    },
    render() {
      const view = new Whisper.ReactWrapperView({
        className: 'invite-friends-dialog',
        Component: window.Signal.Components.InviteFriendsDialog,
        props: {
          friendList: this.friends,
          onSubmit: this.submit,
          onClose: this.close,
          chatName: this.chatName,
        },
      });

      this.$el.append(view.el);
      return this;
    },
    close() {
      this.remove();
    },
    submit(pubkeys) {
      window.sendGroupInvitations(
        { address: this.chatServer, name: this.chatName },
        pubkeys
      );
    },
  });
})();
