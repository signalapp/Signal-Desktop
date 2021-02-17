// Copyright 2015-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global i18n: false */
/* global Whisper: false */

// eslint-disable-next-line func-names
(function () {
  window.Whisper = window.Whisper || {};

  // This enum-like object describes the load state of `DebugLogView`. It's designed to be
  //   unidirectional; `NotStarted` → `Started` → `LogsFetchedButNotInTextarea`, etc.
  const LoadState = {
    NotStarted: 0,
    Started: 1,
    LogsFetchedButNotInTextarea: 2,
    PuttingLogsInTextarea: 3,
    LogsInTextarea: 4,
  };

  Whisper.LoadingFullLogsToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('loading') };
    },
  });

  Whisper.LinkedCopiedToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('debugLogLinkCopied') };
    },
  });

  Whisper.DebugLogLinkView = Whisper.View.extend({
    templateName: 'debug-log-link',
    initialize(options) {
      this.url = options.url;
    },
    events: {
      'click .copy': 'copy',
    },
    render_attributes() {
      return {
        url: this.url,
        reportIssue: i18n('reportIssue'),
        debugLogCopy: i18n('debugLogCopy'),
        debugLogCopyAlt: i18n('debugLogCopyAlt'),
      };
    },
    copy(e) {
      e.preventDefault();
      window.copyText(e.currentTarget.href);
      Whisper.ToastView.show(Whisper.LinkedCopiedToast, document.body);
    },
  });

  /**
   * The bulk of the logic in this view involves grabbing the logs from disk and putting
   * them in a `<textarea>`. The first part isn't instant but is reasonably fast; setting
   * the textarea's `value` takes a long time.
   *
   * After loading the logs into memory, we only put a small number of lines into the
   * textarea. If the user clicks or scrolls the textarea, we pull the full logs, which
   * can cause the system to lock up for a bit.
   *
   * Ideally, we'd only show a sampling of the logs and allow the user to download and
   * edit them in their own editor. This is mostly a stopgap solution.
   */
  Whisper.DebugLogView = Whisper.View.extend({
    templateName: 'debug-log',
    className: 'debug-log modal',
    initialize() {
      this.render();

      this.textarea = this.$('.textarea').get(0);
      if (!this.textarea) {
        throw new Error('textarea not found');
      }
      this.textarea.setAttribute('readonly', '');

      this.loadState = LoadState.NotStarted;
      this.putFullLogsInTextareaPlease = false;

      this.fetchLogs();
    },
    events: {
      'click .textarea': 'putFullLogsInTextarea',
      'scroll .textarea': 'putFullLogsInTextarea',
      'wheel .textarea': 'putFullLogsInTextarea',
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
    async fetchLogs() {
      if (this.loadState !== LoadState.NotStarted) {
        return;
      }

      this.loadState = LoadState.Started;
      this.textarea.value = i18n('loading');
      this.$('.submit').attr('disabled', 'disabled');

      this.logText = await window.log.fetch();
      this.loadState = LoadState.LogsFetchedButNotInTextarea;

      // This number is somewhat arbitrary; we want to show enough that it's clear that
      //   we need to scroll, but not so many that things get slow.
      const linesToShow = Math.ceil(Math.min(window.innerHeight, 2000) / 5);
      this.textarea.value = this.logText
        .split(/\n/g)
        .slice(0, linesToShow)
        .concat(['', i18n('loading')])
        .join('\n');

      this.$('.submit').removeAttr('disabled');

      if (this.putFullLogsInTextareaPlease) {
        this.putFullLogsInTextarea();
      }
    },
    putFullLogsInTextarea() {
      switch (this.loadState) {
        case LoadState.NotStarted:
        case LoadState.Started:
          this.putFullLogsInTextareaPlease = true;
          break;
        case LoadState.LogsInTextarea:
        case LoadState.PuttingLogsInTextarea:
          break;
        case LoadState.LogsFetchedButNotInTextarea:
          if (!this.logText) {
            throw new Error('Expected log text to be present');
          }
          this.loadState = LoadState.PuttingLogsInTextarea;
          Whisper.ToastView.show(Whisper.LoadingFullLogsToast, document.body);
          setTimeout(() => {
            this.textarea.value = this.logText;
            this.textarea.removeAttribute('readonly');
            this.loadState = LoadState.LogsInTextarea;
          }, 0);
          break;
        default:
          // When we can, we should make this throw a `missingCaseError`.
          break;
      }
    },
    close() {
      window.closeDebugLog();
    },
    async submit(e) {
      e.preventDefault();

      let text;
      switch (this.loadState) {
        case LoadState.NotStarted:
        case LoadState.Started:
          return;
        case LoadState.LogsFetchedButNotInTextarea:
          text = this.logText;
          break;
        case LoadState.LogsInTextarea:
          text = this.textarea.value;
          break;
        default:
          // When we can, we should make this throw a `missingCaseError`.
          return;
      }

      if (text.length === 0) {
        return;
      }

      this.$('.buttons, .textarea').remove();
      this.$('.result').addClass('loading');

      try {
        const publishedLogURL = await window.log.publish(
          text,
          window.getVersion()
        );
        const view = new Whisper.DebugLogLinkView({
          url: publishedLogURL,
          el: this.$('.result'),
        });
        this.$('.loading').removeClass('loading');
        view.render();
        this.$('.link').focus().select();
      } catch (error) {
        window.log.error(
          'DebugLogView error:',
          error && error.stack ? error.stack : error
        );
        this.$('.loading').removeClass('loading');
        this.$('.result').text(i18n('debugLogError'));
      }
    },
  });
})();
