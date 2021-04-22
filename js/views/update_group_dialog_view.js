/* global Whisper, i18n, _ */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.UpdateGroupNameDialogView = Whisper.View.extend({
    className: 'loki-dialog modal',
    initialize(groupConvo) {
      this.groupName = groupConvo.get('name');

      this.conversation = groupConvo;
      this.titleText = i18n('updateGroupDialogTitle', this.groupName);

      this.close = this.close.bind(this);
      this.onSubmit = this.onSubmit.bind(this);
      this.isPublic = groupConvo.isPublic();
      this.groupId = groupConvo.id;
      this.members = groupConvo.get('members') || [];
      this.avatarPath = groupConvo.getAvatarPath();
      this.theme = groupConvo.theme;

      // any member can update a closed group name
      this.isAdmin = true;

      // public chat settings overrides
      if (this.isPublic) {
        // fix the title
        this.titleText = i18n('updateGroupDialogTitle', this.groupName);
        // I'd much prefer to integrate mods with groupAdmins
        // but lets discuss first...
        this.isAdmin = groupConvo.isAdmin(window.storage.get('primaryDevicePubKey'));
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
          pubkey: this.groupId,
          groupName: this.groupName,
          okText: i18n('ok'),
          cancelText: i18n('cancel'),
          isAdmin: this.isAdmin,
          i18n,
          onSubmit: this.onSubmit,
          onClose: this.close,
          avatarPath: this.avatarPath,
          theme: this.theme,
        },
      });

      this.$el.append(this.dialogView.el);
      return this;
    },
    onSubmit(groupName, avatar) {
      if (groupName !== this.groupName || avatar !== this.avatarPath) {
        window.libsession.ClosedGroup.initiateGroupUpdate(
          this.groupId,
          groupName,
          this.members,
          avatar
        );
      }
    },
    close() {
      this.remove();
    },
  });

  Whisper.UpdateGroupMembersDialogView = Whisper.View.extend({
    className: 'loki-dialog modal',
    initialize(groupConvo) {
      this.groupName = groupConvo.get('name');
      this.close = this.close.bind(this);
      this.onSubmit = this.onSubmit.bind(this);
      this.isPublic = groupConvo.isPublic();
      this.groupId = groupConvo.id;
      this.avatarPath = groupConvo.getAvatarPath();
      this.theme = groupConvo.theme;

      if (this.isPublic) {
        this.titleText = i18n('updateGroupDialogTitle', this.groupName);
        // I'd much prefer to integrate mods with groupAdmins
        // but lets discuss first...
        this.isAdmin = groupConvo.isAdmin(window.storage.get('primaryDevicePubKey'));
        // zero out contactList for now
        this.contactsAndMembers = [];
        this.existingMembers = [];
      } else {
        this.titleText = i18n('updateGroupDialogTitle', this.groupName);
        // anybody can edit a closed group name or members
        const ourPK = window.libsession.Utils.UserUtils.getOurPubKeyStrFromCache();
        this.isAdmin = groupConvo.isMediumGroup()
          ? true
          : groupConvo.get('groupAdmins').includes(ourPK);
        this.admins = groupConvo.get('groupAdmins');
        const convos = window
          .getConversationController()
          .getConversations()
          .filter(d => !!d);

        this.existingMembers = groupConvo.get('members') || [];
        // Show a contact if they are our friend or if they are a member
        this.contactsAndMembers = convos.filter(
          d => this.existingMembers.includes(d.id) && d.isPrivate() && !d.isMe()
        );
        this.contactsAndMembers = _.uniq(this.contactsAndMembers, true, d => d.id);

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
          okText: i18n('ok'),
          cancelText: i18n('cancel'),
          isPublic: this.isPublic,
          existingMembers: this.existingMembers,
          contactList: this.contactsAndMembers,
          isAdmin: this.isAdmin,
          admins: this.admins,
          onClose: this.close,
          onSubmit: this.onSubmit,
          groupId: this.groupId,
          theme: this.theme,
        },
      });

      this.$el.append(this.dialogView.el);
      return this;
    },
    async onSubmit(newMembers) {
      const _ = window.Lodash;
      const ourPK = window.libsession.Utils.UserUtils.getOurPubKeyStrFromCache();
      const allMembers = window.Lodash.concat(newMembers, [ourPK]);

      // We need to NOT trigger an group update if the list of member is the same.
      const notPresentInOld = allMembers.filter(m => !this.existingMembers.includes(m));

      const membersToRemove = this.existingMembers.filter(m => !allMembers.includes(m));

      // If any extra devices of removed exist in newMembers, ensure that you filter them
      const filteredMemberes = allMembers.filter(member => !_.includes(membersToRemove, member));

      const xor = _.xor(membersToRemove, notPresentInOld);
      if (xor.length === 0) {
        window.log.info('skipping group update: no detected changes in group member list');

        return;
      }

      window.libsession.ClosedGroup.initiateGroupUpdate(
        this.groupId,
        this.groupName,
        filteredMemberes,
        this.avatarPath
      );
    },
    close() {
      this.remove();
    },
  });
})();
