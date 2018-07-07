/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.HintView = Whisper.View.extend({
    templateName: 'hint',
    initialize(options) {
      this.content = options.content;
    },
    render_attributes() {
      return { content: this.content };
    },
  });
})();
