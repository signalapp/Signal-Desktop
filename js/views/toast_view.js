/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.ToastView = Whisper.View.extend({
        className: 'toast',
        initialize: function() {
            this.$el.hide();
        },

        close: function() {
            this.$el.fadeOut(this.remove.bind(this));
        },

        render: function() {
            this.$el.html(Mustache.render(this.template, this.model));
            this.$el.show();
            setTimeout(this.close.bind(this), 2000);
        }
    });
})();
