/* global Whisper, _ */

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
      this.channelId = convo.get('channelId');
      this.isPublic = !!convo.cachedProps.isPublic;
      this.convo = convo;

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
      // public group chats
      if (this.isPublic) {
        window.sendGroupInvitations(
          {
            address: this.chatServer,
            name: this.chatName,
            channelId: this.channelId,
          },
          pubkeys
        );
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
            window.CONSTANTS.SMALL_GROUP_SIZE_LIMIT
          ) {
            const msg = window.i18n(
              'maxGroupMembersError',
              window.CONSTANTS.SMALL_GROUP_SIZE_LIMIT
            );

            window.pushToast({
              title: msg,
              type: 'error',
              id: 'tooManyMembers',
            });
            return;
          }

          const allMembers = window.Lodash.concat(existingMembers, newMembers, [
            ourPK,
          ]);
          const uniqMembers = _.uniq(allMembers, true, d => d);

          const groupId = this.convo.get('id');
          const groupName = this.convo.get('name');

          window.doUpdateGroup(groupId, groupName, uniqMembers);
        }
      }
    },
  });
})();
