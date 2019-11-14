/* global Whisper, */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.BulkEditView = Whisper.View.extend({
    initialize(options) {
      this.props = {
        onCancel: options.onCancel,
        onDelete: options.onDelete,
        messageCount: 0,
      };

      this.memberView = new Whisper.ReactWrapperView({
        className: 'bulk-edit-view',
        Component: window.Signal.Components.BulkEdit,
        props: this.props,
      });

      this.$el.append(this.memberView.el);
    },
    render() {
      this.memberView.update(this.props);
    },

    update(selectionSize) {
      this.props.messageCount = selectionSize;
      this.render();
    },
  });
})();
