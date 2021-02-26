// Copyright 2015-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/*
 * Defines a default definition for render() which allows sub-classes
 * to simply specify a template property and renderAttributes which are plugged
 * into Mustache.render
 */

// eslint-disable-next-line func-names
(function () {
  window.Whisper = window.Whisper || {};

  window.Whisper.View = Backbone.View.extend({
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    constructor(...params: Array<any>) {
      window.Backbone.View.call(this, ...params);

      // Checks for syntax errors
      window.Mustache.parse(_.result(this, 'template'));
    },
    render_attributes() {
      return _.result(this.model, 'attributes', {});
    },
    render() {
      const attrs = window._.result(this, 'render_attributes', {});
      const template = window._.result(this, 'template', '');
      this.$el.html(window.Mustache.render(template, attrs));
      return this;
    },
  });
})();
