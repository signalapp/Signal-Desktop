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
            this.$('.link').on('mouseup', function (e) {
                e.preventDefault();
                $(this).select();
            });
            this.$('.report-link').text(this.$('.report-link').text().trim());
        },
        events: {
            'click .submit': 'submit',
            'click .close': 'close',
            'click .report-link': 'report'
        },
        render_attributes: {
            title: i18n('submitDebugLog'),
            cancel: i18n('cancel'),
            submit: i18n('submit'),
            close: i18n('gotIt'),
            open: i18n('open'),
            debugLogExplanation: i18n('debugLogExplanation'),
            reportIssue: i18n('reportIssue')
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
                this.$('.loading').removeClass('loading');
                this.$('.link').val(url);
                this.$('.open').click(function() {
                    window.open(url);
                });
                this.$('.result .hide').removeClass('hide');
                this.$('.link').select().focus();
            }.bind(this));
            this.$('.buttons, textarea').remove();
            this.$('.result').addClass('loading');
        },
        report: function(e) {
            window.open("https://github.com/WhisperSystems/Signal-Desktop/issues/new");
        }
    });

})();
