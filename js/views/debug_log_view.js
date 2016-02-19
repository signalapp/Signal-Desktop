/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.DebugLogView = Whisper.View.extend({
        templateName: 'debug-log',
        className: 'debug-log modal',
        initialize: function() {
            this.render();
            this.$('textarea').val(console.get());
        },
        events: {
            'submit': 'submit',
            'click .close': 'close'
        },
        render_attributes: {
            title: i18n('submitDebugLog'),
            cancel: i18n('cancel'),
            submit: i18n('submit'),
            close: i18n('gotIt'),
            debugLogExplanation: i18n('debugLogExplanation')
        },
        close: function(e) {
            e.preventDefault();
            this.remove();
        },
        submit: function(e) {
            e.preventDefault();
            console.post(this.$('textarea').val()).then(function(url) {
                this.$el.removeClass('loading');
                var link = this.$('.result').show().find('a');
                link.attr('href', url).text(url);
            }.bind(this));
            this.$('form').remove();
            this.$el.addClass('loading');
        }
    });

})();
