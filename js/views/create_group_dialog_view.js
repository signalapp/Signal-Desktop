/* global Whisper, i18n, textsecure, libloki, _ */

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

        console.log('[vince] UpdateGroupMembersDialogView this AFTER', this);
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
          okText: i18n('ok'),
          cancelText: i18n('cancel'),
          isPublic: this.isPublic,
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
    onSubmit(newMembers) {
      const ourPK = textsecure.storage.user.getNumber();
      const allMembers = window.Lodash.concat(newMembers, [ourPK]);

      

      // We need to NOT trigger an group update if the list of member is the same.
      const notPresentInOld = allMembers.filter(
        m => !this.existingMembers.includes(m)
      );

      // Filter out all linked devices for cases in which one device
      // exists in group, but hasn't yet synced with its other devices.
      const notPresentInNew = this.existingMembers.filter(
        m => !allMembers.includes(m)
      );

      // Get all devices for notPresentInNew
      const allDevicesOfMembersToRemove = [];
      notPresentInNew.forEach(async member => {
        const pairedDevices = await libloki.storage.getPairedDevicesFor(member);
        allDevicesOfMembersToRemove.push(member, ...pairedDevices);
      });

      const allToRemove = allDevicesOfMembersToRemove.filter(
        m => this.existingMembers.includes(m)
      );

      // would be easer with _.xor but for some reason we do not have it
      const xor = notPresentInNew.concat(notPresentInOld);
      if (xor.length === 0) {
        window.console.log(
          'skipping group update: no detected changes in group member list'
        );

        return;
      }

      console.log('[vince] allDevicesOfMembersToRemove:', allDevicesOfMembersToRemove);
      console.log('[vince] allMembers:', allMembers);
      console.log('[vince] notPresentInOld:', notPresentInOld);
      console.log('[vince] notPresentInNew:', notPresentInNew);
      console.log('[vince] xor:', xor);
      console.log('[vince] allToRemove:', allToRemove);
      
      alert('returning earlyyyy');

      // window.doUpdateGroup(
      //   this.groupId,
      //   this.groupName,
      //   allMembers,
      //   this.avatarPath
      // );
    },
    close() {
      this.remove();
    },
  });
})();
