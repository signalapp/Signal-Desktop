/* global i18n: false */
/* global Whisper: false */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.DebugLogLinkView = Whisper.View.extend({
    templateName: 'debug-log-link',
    initialize(options) {
      this.url = options.url;
    },
    render_attributes() {
      return {
        url: this.url,
        reportIssue: i18n('reportIssue'),
      };
    },
  });
  Whisper.DebugLogView = Whisper.View.extend({
    templateName: 'debug-log',
    className: 'debug-log modal',
    initialize() {
      this.render();
      this.$('textarea').val(i18n('loading'));

      // eslint-disable-next-line more/no-then
      window.log.fetch().then(text => {
        this.$('textarea').val(text);
      });
    },
    events: {
      'click .submit': 'submit',
      'click .close': 'close',
    },
    render_attributes: {
      title: i18n('submitDebugLog'),
      cancel: i18n('cancel'),
      submit: i18n('submit'),
      close: i18n('gotIt'),
      debugLogExplanation: i18n('debugLogExplanation'),
    },
    close(e) {
      e.preventDefault();
      this.remove();
    },
    async submit(e) {
      e.preventDefault();
      const text = this.$('textarea').val();
      if (text.length === 0) {
        return;
      }

      this.$('.buttons, textarea').remove();
      this.$('.result').addClass('loading');

      const publishedLogURL = await window.log.publish(text);
      const view = new Whisper.DebugLogLinkView({
        url: publishedLogURL,
        el: this.$('.result'),
      });
      this.$('.loading').removeClass('loading');
      view.render();
      this.$('.link')
        .focus()
        .select();
    },
  });
})();
