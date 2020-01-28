/* global Whisper, Backbone, Mustache, _, $ */

/*
 * Whisper.View
 *
 * This is the base for most of our views. The Backbone view is extended
 * with some conveniences:
 *
 * 1. Pre-parses all our mustache templates for performance.
 * https://github.com/janl/mustache.js#pre-parsing-and-caching-templates
 *
 * 2. Defines a default definition for render() which allows sub-classes
 * to simply specify a templateName and renderAttributes which are plugged
 * into Mustache.render
 *
 * 3. Makes all the templates available for rendering as partials.
 * https://github.com/janl/mustache.js#partials
 *
 * 4. Provides some common functionality, e.g. confirmation dialog
 *
 */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.View = Backbone.View.extend(
    {
      constructor(...params) {
        Backbone.View.call(this, ...params);
        Mustache.parse(_.result(this, 'template'));
      },
      render_attributes() {
        return _.result(this.model, 'attributes', {});
      },
      render_partials() {
        return Whisper.View.Templates;
      },
      template() {
        if (this.templateName) {
          return Whisper.View.Templates[this.templateName];
        }
        return '';
      },
      render() {
        const attrs = _.result(this, 'render_attributes', {});
        const template = _.result(this, 'template', '');
        const partials = _.result(this, 'render_partials', '');
        this.$el.html(Mustache.render(template, attrs, partials));
        return this;
      },
      confirm(message, okText) {
        return new Promise((resolve, reject) => {
          window.confirmationDialog({
            title: message,
            okText,
            resolve,
            reject,
          });
        });
      },
    },
    {
      // Class attributes
      Templates: (() => {
        const templates = {};
        $('script[type="text/x-tmpl-mustache"]').each((i, el) => {
          const $el = $(el);
          const id = $el.attr('id');
          templates[id] = $el.html();
        });
        return templates;
      })(),
    }
  );
})();
