/* global Whisper, i18n, textsecure, _ */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.CreateGroupDialogView = Whisper.View.extend({
    className: 'loki-dialog modal',
    initialize() {
      this.titleText = i18n('createGroupDialogTitle');
      this.okText = i18n('ok');
      this.cancelText = i18n('cancel');
      this.close = this.close.bind(this);

      const convos = window.getConversations().models;

      let allMembers = convos.filter(
        d => !!d && d.isFriend() && d.isPrivate() && !d.isMe()
      );
      allMembers = _.uniq(allMembers, true, d => d.id);

      this.membersToShow = allMembers;

      this.$el.focus();
      this.render();
    },
    render() {
      this.dialogView = new Whisper.ReactWrapperView({
        className: 'create-group-dialog',
        Component: window.Signal.Components.CreateGroupDialog,
        props: {
          titleText: this.titleText,
          okText: this.okText,
          cancelText: this.cancelText,
          friendList: this.membersToShow,
          onClose: this.close,
        },
      });

      this.$el.append(this.dialogView.el);
      return this;
    },
    close() {
      this.remove();
    },
  });

  Whisper.LeaveGroupDialogView = Whisper.View.extend({
    className: 'loki-dialog modal',
    initialize(groupConvo) {
      this.groupConvo = groupConvo;
      this.titleText = groupConvo.get('name');
      this.messageText = i18n('leaveGroupDialogTitle');
      this.okText = i18n('yes');
      this.cancelText = i18n('cancel');

      this.close = this.close.bind(this);
      this.confirm = this.confirm.bind(this);

      this.$el.focus();
      this.render();
    },
    render() {
      this.dialogView = new Whisper.ReactWrapperView({
        className: 'leave-group-dialog',
        Component: window.Signal.Components.ConfirmDialog,
        props: {
          titleText: this.titleText,
          messageText: this.messageText,
          okText: this.okText,
          cancelText: this.cancelText,
          onConfirm: this.confirm,
          onClose: this.close,
        },
      });

      this.$el.append(this.dialogView.el);
      return this;
    },
    async confirm() {
      await this.groupConvo.leaveGroup();
      this.close();
    },
    close() {
      this.remove();
    },
  });

  Whisper.UpdateGroupDialogView = Whisper.View.extend({
    className: 'loki-dialog modal',
    initialize(groupConvo) {
      this.groupName = groupConvo.get('name');

      this.conversation = groupConvo;
      this.titleText = `${i18n('updateGroupDialogTitle')}: ${this.groupName}`;
      this.okText = i18n('ok');
      this.cancelText = i18n('cancel');
      this.close = this.close.bind(this);
      this.onSubmit = this.onSubmit.bind(this);
      this.isPublic = groupConvo.isPublic();

      const ourPK = textsecure.storage.user.getNumber();

      this.isAdmin = groupConvo.get('groupAdmins').includes(ourPK);

      const convos = window.getConversations().models;

      let allMembers = convos.filter(d => !!d);
      allMembers = allMembers.filter(
        d => d.isFriend() && d.isPrivate() && !d.isMe()
      );
      allMembers = _.uniq(allMembers, true, d => d.id);

      this.friendList = allMembers;

      // only give members that are not already in the group
      let existingMembers = groupConvo.get('members');

      // at least make sure it's an array
      if (!Array.isArray(existingMembers)) {
        existingMembers = [];
      }

      this.existingMembers = existingMembers;

      // public chat settings overrides
      if (this.isPublic) {
        // fix the title
        this.titleText = `${i18n('updatePublicGroupDialogTitle')}: ${
          this.groupName
        }`;
        // I'd much prefer to integrate mods with groupAdmins
        // but lets discuss first...
        this.isAdmin = groupConvo.isModerator(
          window.storage.get('primaryDevicePubKey')
        );
        // zero out friendList for now
        this.friendList = [];
        this.existingMembers = [];
      }

      this.$el.focus();
      this.render();
    },
    render() {
      this.dialogView = new Whisper.ReactWrapperView({
        className: 'create-group-dialog',
        Component: window.Signal.Components.UpdateGroupDialog,
        props: {
          titleText: this.titleText,
          groupName: this.groupName,
          okText: this.okText,
          isPublic: this.isPublic,
          cancelText: this.cancelText,
          existingMembers: this.existingMembers,
          friendList: this.friendList,
          isAdmin: this.isAdmin,
          onClose: this.close,
          onSubmit: this.onSubmit,
        },
      });

      this.$el.append(this.dialogView.el);
      return this;
    },
    onSubmit(newGroupName, newMembers) {
      const ourPK = textsecure.storage.user.getNumber();
      const allMembers = window.Lodash.concat(newMembers, [ourPK]);
      const groupId = this.conversation.get('id');

      window.doUpdateGroup(groupId, newGroupName, allMembers);
    },
    close() {
      this.remove();
    },
  });
})();
