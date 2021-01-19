/* global Whisper, _ */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.InviteContactsDialogView = Whisper.View.extend({
    className: 'loki-dialog modal',
    initialize(convo) {
      this.close = this.close.bind(this);
      this.submit = this.submit.bind(this);
      this.theme = convo.theme;
      const convos = window.getConversationController().getConversations();

      this.contacts = convos.filter(
        d =>
          !!d &&
          !d.isBlocked() &&
          d.isPrivate() &&
          !d.isMe() &&
          !!d.get('active_at')
      );
      if (!convo.isPublic()) {
        const members = convo.get('members') || [];
        this.contacts = this.contacts.filter(d => !members.includes(d.id));
      }

      this.chatName = convo.get('name');
      this.chatServer = convo.get('server');
      this.channelId = convo.get('channelId');
      this.isPublic = !!convo.cachedProps.isPublic;
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
          onSubmit: this.submit,
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
    submit(pubkeys) {
      // public group chats
      if (this.isPublic) {
        const serverInfos = {
          address: this.chatServer,
          name: this.chatName,
          channelId: this.channelId,
        };
        pubkeys.forEach(async pubkeyStr => {
          const convo = await window
            .getConversationController()
            .getOrCreateAndWait(pubkeyStr, 'private');

          if (convo) {
            convo.sendMessage('', null, null, null, serverInfos);
          }
        });
      } else {
        // private group chats
        const ourPK = window.textsecure.storage.user.getNumber();
        let existingMembers = this.convo.get('members') || [];
        // at least make sure it's an array
        if (!Array.isArray(existingMembers)) {
          existingMembers = [];
        }
        existingMembers = existingMembers.filter(d => !!d);
        const newMembers = pubkeys.filter(d => !existingMembers.includes(d));

        if (newMembers.length > 0) {
          // Do not trigger an update if there is too many members
          if (
            newMembers.length + existingMembers.length >
            window.CONSTANTS.CLOSED_GROUP_SIZE_LIMIT
          ) {
            window.libsession.Utils.ToastUtils.pushTooManyMembers();
            return;
          }

          const allMembers = window.Lodash.concat(existingMembers, newMembers, [
            ourPK,
          ]);
          const uniqMembers = _.uniq(allMembers, true, d => d);

          const groupId = this.convo.get('id');
          const groupName = this.convo.get('name');

          window.libsession.ClosedGroupV2.initiateGroupUpdate(
            groupId,
            groupName,
            uniqMembers
          );
        }
      }
    },
  });
})();
