/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.AttachmentPreviewView = Whisper.View.extend({
    className: 'attachment-preview',
    templateName: 'attachment-preview',
    render_attributes() {
      return { source: this.src };
    },
  });
})();
