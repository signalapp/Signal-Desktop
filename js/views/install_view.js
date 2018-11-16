/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.InstallView = Whisper.View.extend({
        templateName: 'install_flow_template',
        render_attributes: function() {
            var playStoreHref = 'https://play.google.com/store/apps/details?id=org.thoughtcrime.securesms';
            var appStoreHref = 'https://itunes.apple.com/us/app/signal-private-messenger/id874139669';
            var twitterHref = 'https://twitter.com/whispersystems';
            return {
                preLinkExpiredHeader: i18n('preLinkExpiredHeader'),
                startExportIntroParagraph1: i18n('startExportIntroParagraph1'),
                getNewVersion: i18n('getNewVersion'),
            };
        },
        initialize: function(options) {
            console.log('initialize!', this);
            this.render();
            this.$('#step1').show();
        },
    });
})();
