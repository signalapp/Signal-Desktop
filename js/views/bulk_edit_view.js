/* global Whisper, */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.BulkEditView = Whisper.View.extend({
    initialize(options) {
      this.memberView = null;
      this.props = {
        onCancel: options.onCancel,
        onDelete: options.onDelete,
        messageCount: 0,
      };
    },
    render() {
      if (this.memberView) {
        this.memberView.update(this.props);
        return;
      }
      this.memberView = new Whisper.ReactWrapperView({
        className: 'bulk-edit-view',
        Component: window.Signal.Components.BulkEdit,
        props: this.props,
      });

      this.$el.append(this.memberView.el);
    },

    update(selectionSize) {
      this.props.messageCount = selectionSize;
      this.render();
    },
  });
})();
