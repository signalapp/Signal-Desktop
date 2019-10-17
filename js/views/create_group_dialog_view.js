/* global Whisper, i18n, getInboxCollection _ */

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

      let allMembers = convos.filter(d => !!d);
      allMembers = allMembers.filter(d => d.isFriend() && d.isPrivate());
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

  Whisper.UpdateGroupDialogView = Whisper.View.extend({
    templateName: 'group-creation-template',
    className: 'loki-dialog modal',
    initialize(groupConvo) {
      this.groupName = groupConvo.get('name');

      this.conversation = groupConvo;
      this.titleText = `${i18n('updateGroupDialogTitle')}: ${this.groupName}`;
      this.okText = i18n('ok');
      this.cancelText = i18n('cancel');
      this.close = this.close.bind(this);
      this.onSubmit = this.onSubmit.bind(this);

      const convos = getInboxCollection().models;

      let allMembers = convos.filter(d => !!d);
      allMembers = allMembers.filter(d => d.isFriend());
      allMembers = allMembers.filter(d => d.isPrivate());
      allMembers = _.uniq(allMembers, true, d => d.id);

      // only give members that are not already in the group
      const existingMembers = groupConvo.get('members');
      this.membersToShow = allMembers.filter(
        d => !_.some(existingMembers, x => x === d.id)
      );

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
          cancelText: this.cancelText,
          friendList: this.membersToShow,
          onClose: this.close,
          onSubmit: this.onSubmit,
        },
      });

      this.$el.append(this.dialogView.el);
      return this;
    },
    onSubmit(newGroupName, newMembers) {
      const allMembers = window.Lodash.concat(
        newMembers,
        this.conversation.get('members')
      );
      const groupId = this.conversation.get('id');

      window.doUpdateGroup(groupId, newGroupName, allMembers);
    },
    close() {
      this.remove();
    },
  });
})();
