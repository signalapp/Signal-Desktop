(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  var ErrorView = Whisper.View.extend({
    className: 'error',
    templateName: 'generic-error',
    render_attributes: function() {
      return this.model;
    },
  });
})();
