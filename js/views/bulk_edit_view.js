/* global Whisper, */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.BulkEditView = Whisper.View.extend({
    initialize(options) {
      this.selectedMessages = new Set();
      this.render();
      this.onCancel = options.onCancel;
      this.onDelete = options.onDelete;
    },
    render() {
      if (this.memberView) {
        this.memberView.remove();
        this.memberView = null;
      }

      this.memberView = new Whisper.ReactWrapperView({
        className: 'bulk-edit-view',
        Component: window.Signal.Components.BulkEdit,
        props: {
          messageCount: this.selectedMessages.size,
          onCancel: this.onCancel,
          onDelete: this.onDelete,
        },
      });

      this.$el.append(this.memberView.el);
      return this;
    },

    update(selectedMessages) {
      this.selectedMessages = selectedMessages;
      this.render();
    },
  });
})();
