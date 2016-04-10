/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.DebugLogLinkView = Whisper.View.extend({
        templateName: 'debug-log-link',
        initialize: function(options) {
            this.url = options.url;
        },
        render_attributes: function() {
            return {
                url: this.url,
                reportIssue: i18n('reportIssue')
            };
        }
    });
    Whisper.DebugLogView = Whisper.View.extend({
        templateName: 'debug-log',
        className: 'debug-log modal',
        initialize: function() {
            this.render();
            this.$('textarea').val(console.get());
        },
        events: {
            'click .submit': 'submit',
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
            var log = this.$('textarea').val();
            if (log.length === 0) {
                return;
            }
            console.post(log).then(function(url) {
                var view = new Whisper.DebugLogLinkView({
                    url: url,
                    el: this.$('.result')
                });
                this.$('.loading').removeClass('loading');
                view.render();
                this.$('.link').focus().select();
            }.bind(this));
            this.$('.buttons, textarea').remove();
            this.$('.result').addClass('loading');
        }
    });

})();
