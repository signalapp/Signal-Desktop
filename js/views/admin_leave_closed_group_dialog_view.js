/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.AdminLeaveClosedGroupDialog = Whisper.View.extend({
    className: 'loki-dialog modal',
    initialize(convo) {
      this.close = this.close.bind(this);
      this.submit = this.submit.bind(this);
      this.theme = convo.theme;
      this.groupName = convo.get('name');
      this.convo = convo;

      this.$el.focus();
      this.render();
    },
    render() {
      const view = new Whisper.ReactWrapperView({
        className: 'admin-leave-closed-group',
        Component: window.Signal.Components.AdminLeaveClosedGroupDialog,
        props: {
          onSubmit: this.submit,
          onClose: this.close,
          groupName: this.groupName,
          theme: this.theme,
        },
      });

      this.$el.append(view.el);
      return this;
    },
    close() {
      this.remove();
    },
    submit() {
      this.convo.leaveClosedGroup();
    },
  });
})();
