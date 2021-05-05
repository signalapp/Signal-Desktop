/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.InviteContactsDialogView = Whisper.View.extend({
    className: 'loki-dialog modal',
    initialize(convo) {
      this.close = this.close.bind(this);
      this.theme = convo.theme;
      const convos = window.getConversationController().getConversations();

      this.contacts = convos.filter(
        d => !!d && !d.isBlocked() && d.isPrivate() && !d.isMe() && !!d.get('active_at')
      );
      if (!convo.isPublic()) {
        // filter our zombies and current members from the list of contact we can add

        const members = convo.get('members') || [];
        const zombies = convo.get('zombies') || [];
        this.contacts = this.contacts.filter(
          d => !members.includes(d.id) && !zombies.includes(d.id)
        );
      }

      this.chatName = convo.get('name');
      this.chatServer = convo.get('server');
      this.channelId = convo.get('channelId');
      this.isPublic = !!convo.isPublic();
      this.convo = convo;

      this.$el.focus();
      this.render();
    },
    render() {
      const view = new Whisper.ReactWrapperView({
        className: 'invite-friends-dialog',
        Component: window.Signal.Components.InviteContactsDialog,
        props: {
          contactList: this.contacts,
          onClose: this.close,
          chatName: this.chatName,
          theme: this.theme,
          convo: this.convo,
        },
      });

      this.$el.append(view.el);
      return this;
    },
    close() {
      this.remove();
    },
  });
})();
