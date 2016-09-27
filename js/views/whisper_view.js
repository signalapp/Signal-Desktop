/*
 * vim: ts=4:sw=4:expandtab
 *
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
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.View = Backbone.View.extend({
        constructor: function() {
            Backbone.View.apply(this, arguments);
            Mustache.parse(_.result(this, 'template'));
        },
        render_attributes: function() {
            return _.result(this.model, 'attributes', {});
        },
        render_partials: function() {
            return Whisper.View.Templates;
        },
        template: function() {
            if (this.templateName) {
                return Whisper.View.Templates[this.templateName];
            }
            return '';
        },
        render: function() {
            var attrs = _.result(this, 'render_attributes', {});
            var template = _.result(this, 'template', '');
            var partials = _.result(this, 'render_partials', '');
            this.$el.html(Mustache.render(template, attrs, partials));
            return this;
        },
        confirm: function(message) {
            return new Promise(function(resolve, reject) {
                var dialog = new Whisper.ConfirmationDialogView({
                    message: message,
                    resolve: resolve,
                    reject: reject
                });
                this.$el.closest('body').append(dialog.el);
            }.bind(this));
        },
        i18n_with_links: function() {
            var args = Array.prototype.slice.call(arguments);
            for (var i=1; i < args.length; ++i) {
              args[i] = 'class="link" href="' + encodeURI(args[i]) + '" target="_blank"';
            }
            return i18n(args[0], args.slice(1));
        }
    },{
        // Class attributes
        Templates: (function() {
            var templates = {};
            $('script[type="text/x-tmpl-mustache"]').each(function(i, el) {
                var $el = $(el);
                var id = $el.attr('id');
                templates[id] = $el.html();
            });
            return templates;
        }())
    });
})();
