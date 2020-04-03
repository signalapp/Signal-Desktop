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

  Whisper.UpdateGroupNameDialogView = Whisper.View.extend({
    className: 'loki-dialog modal',
    initialize(groupConvo) {
      this.groupName = groupConvo.get('name');

      this.conversation = groupConvo;
      this.titleText = i18n('updateGroupDialogTitle');
      this.close = this.close.bind(this);
      this.onSubmit = this.onSubmit.bind(this);
      this.isPublic = groupConvo.isPublic();
      this.groupId = groupConvo.id;
      this.members = groupConvo.get('members') || [];
      this.avatarPath = groupConvo.getAvatarPath();

      const ourPK = textsecure.storage.user.getNumber();

      this.isAdmin = groupConvo.get('groupAdmins').includes(ourPK);

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
      }

      this.$el.focus();
      this.render();
    },
    render() {
      this.dialogView = new Whisper.ReactWrapperView({
        className: 'create-group-dialog',
        Component: window.Signal.Components.UpdateGroupNameDialog,
        props: {
          titleText: this.titleText,
          isPublic: this.isPublic,
          groupName: this.groupName,
          okText: i18n('ok'),
          cancelText: i18n('cancel'),
          isAdmin: this.isAdmin,
          i18n,
          onSubmit: this.onSubmit,
          onClose: this.close,
          avatarPath: this.avatarPath,
        },
      });

      this.$el.append(this.dialogView.el);
      return this;
    },
    onSubmit(groupName, avatar) {
      window.doUpdateGroup(this.groupId, groupName, this.members, avatar);
    },
    close() {
      this.remove();
    },
  });

  Whisper.UpdateGroupMembersDialogView = Whisper.View.extend({
    className: 'loki-dialog modal',
    initialize(groupConvo) {
      const ourPK = textsecure.storage.user.getNumber();
      this.groupName = groupConvo.get('name');
      this.close = this.close.bind(this);
      this.onSubmit = this.onSubmit.bind(this);
      this.isPublic = groupConvo.isPublic();
      this.groupId = groupConvo.id;
      this.avatarPath = groupConvo.getAvatarPath();

      if (this.isPublic) {
        this.titleText = `${i18n('updatePublicGroupDialogTitle')}: ${
          this.groupName
        }`;
        // I'd much prefer to integrate mods with groupAdmins
        // but lets discuss first...
        this.isAdmin = groupConvo.isModerator(
          window.storage.get('primaryDevicePubKey')
        );
        // zero out friendList for now
        this.friendsAndMembers = [];
        this.existingMembers = [];
      } else {
        this.titleText = i18n('updateGroupDialogTitle');
        this.isAdmin = groupConvo.get('groupAdmins').includes(ourPK);
        const convos = window.getConversations().models.filter(d => !!d);

        this.existingMembers = groupConvo.get('members') || [];
        // Show a contact if they are our friend or if they are a member
        this.friendsAndMembers = convos.filter(
          d => this.existingMembers.includes(d.id) && d.isPrivate() && !d.isMe()
        );
        this.friendsAndMembers = _.uniq(
          this.friendsAndMembers,
          true,
          d => d.id
        );

        // at least make sure it's an array
        if (!Array.isArray(this.existingMembers)) {
          this.existingMembers = [];
        }
      }

      this.$el.focus();
      this.render();
    },
    render() {
      this.dialogView = new Whisper.ReactWrapperView({
        className: 'create-group-dialog',
        Component: window.Signal.Components.UpdateGroupMembersDialog,
        props: {
          titleText: this.titleText,
          groupName: this.groupName,
          okText: this.okText,
          isPublic: this.isPublic,
          cancelText: this.cancelText,
          existingMembers: this.existingMembers,
          friendList: this.friendsAndMembers,
          isAdmin: this.isAdmin,
          onClose: this.close,
          onSubmit: this.onSubmit,
          groupId: this.groupId,
        },
      });

      this.$el.append(this.dialogView.el);
      return this;
    },
    onSubmit(groupName, newMembers) {
      const ourPK = textsecure.storage.user.getNumber();
      const allMembers = window.Lodash.concat(newMembers, [ourPK]);

      window.doUpdateGroup(
        this.groupId,
        groupName,
        allMembers,
        this.avatarPath
      );
    },
    close() {
      this.remove();
    },
  });
})();
