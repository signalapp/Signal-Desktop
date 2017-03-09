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
                installWelcome: i18n('installWelcome'),
                installTagline: i18n('installTagline'),
                installGetStartedButton: i18n('installGetStartedButton'),
                installSignalLink: this.i18n_with_links('installSignalLinks', playStoreHref, appStoreHref),
                installIHaveSignalButton: i18n('installGotIt'),
                installFollowUs: this.i18n_with_links('installFollowUs', twitterHref),
                installAndroidInstructions: i18n('installAndroidInstructions'),
                installLinkingWithNumber: i18n('installLinkingWithNumber'),
                installComputerName: i18n('installComputerName'),
                installFinalButton: i18n('installFinalButton'),
                installTooManyDevices: i18n('installTooManyDevices'),
                ok: i18n('ok'),
            };
        },
        initialize: function(options) {
            this.counter = 0;

            this.render();

            this.$('#device-name').val(options.deviceName);
            this.$('#step1').show();
        },
        events: function() {
            return {
                'click .step1': this.selectStep.bind(this, 1),
                'click .step2': this.selectStep.bind(this, 2),
                'click .step3': this.selectStep.bind(this, 3)
            };
        },
        clearQR: function() {
            this.$('#qr').text(i18n("installConnecting"));
        },
        setProvisioningUrl: function(url) {
            this.$('#qr').html('');
            new QRCode(this.$('#qr')[0]).makeCode(url);
        },
        confirmNumber: function(number) {
            var parsed = libphonenumber.parse(number);
            if (!libphonenumber.isValidNumber(parsed)) {
                throw new Error('Invalid number ' + number);
            }
            this.$('#step4 .number').text(libphonenumber.format(
                parsed,
                libphonenumber.PhoneNumberFormat.INTERNATIONAL
            ));
            this.selectStep(4);
            this.$('#device-name').focus();
            return new Promise(function(resolve, reject) {
                this.$('#step4 .cancel').click(function(e) {
                    reject();
                });
                this.$('#step4').submit(function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    var name = this.$('#device-name').val();
                    name = name.replace(/\0/g,''); // strip unicode null
                    if (name.trim().length === 0) {
                        this.$('#device-name').focus();
                        return;
                    }
                    this.$('.progress-dialog .status').text(i18n('installGeneratingKeys'));
                    this.selectStep(5);
                    resolve(name);
                }.bind(this));
            }.bind(this));
        },
        incrementCounter: function() {
            this.$('.progress-dialog .bar').css('width', (++this.counter * 100 / 100) + '%');
        },
        selectStep: function(step) {
            this.$('.step').hide();
            this.$('#step' + step).show();
        },
        showSync: function() {
            this.$('.progress-dialog .status').text(i18n('installSyncingGroupsAndContacts'));
            this.$('.progress-dialog .bar').addClass('progress-bar-striped active');
        },
        showTooManyDevices: function() {
            this.selectStep('TooManyDevices');
        },
        showConnectionError: function() {
            this.$('#qr').text(i18n("installConnectionFailed"));
        }
    });
})();
