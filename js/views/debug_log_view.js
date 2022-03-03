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

      const operatingSystemInfo = `Operating System: ${window.getOSRelease()}`;

      const commitHashInfo = window.getCommitHash() ? `Commit Hash: ${window.getCommitHash()}` : '';

      // eslint-disable-next-line more/no-then
      window.log.fetch().then(text => {
        const debugLogWithSystemInfo = operatingSystemInfo + commitHashInfo + text;

        this.$('textarea').val(debugLogWithSystemInfo);
      });
    },
    events: {
      'click .submit': 'submit',
      'click .close': 'close',
    },
    render_attributes: {
      title: i18n('debugLog'),
      cancel: i18n('cancel'),
      submit: i18n('saveLogToDesktop'),
      debugLogExplanation: i18n('debugLogExplanation'),
    },
    close() {
      window.closeDebugLog();
    },
    async submit(e) {
      e.preventDefault();
      const text = this.$('textarea').val();
      if (text.length === 0) {
        return;
      }
      window.saveLog(text);
      window.closeDebugLog();
    },
  });
})();
