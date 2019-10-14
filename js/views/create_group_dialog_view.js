/* global Whisper, i18n, getInboxCollection _ */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.CreateGroupDialogView = Whisper.View.extend({
    templateName: 'group-creation-template',
    className: 'loki-dialog modal',
    initialize() {
      this.titleText = i18n('createGroupDialogTitle');
      this.okText = i18n('ok');
      this.cancelText = i18n('cancel');
      this.close = this.close.bind(this);
      this.$el.focus();
      this.render();
    },
    render() {
      const convos = getInboxCollection().models;

      let allMembers = convos.filter(d => !!d);
      allMembers = allMembers.filter(d => d.isFriend());
      allMembers = allMembers.filter(d => d.isPrivate());
      allMembers = _.uniq(allMembers, true, d => d.id);

      this.dialogView = new Whisper.ReactWrapperView({
        className: 'create-group-dialog',
        Component: window.Signal.Components.CreateGroupDialog,
        props: {
          titleText: this.titleText,
          okText: this.okText,
          cancelText: this.cancelText,
          friendList: allMembers,
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
})();
