/*
 * vim: ts=4:sw=4:expandtab
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
                this.$el.append(dialog.el);
            }.bind(this));
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
