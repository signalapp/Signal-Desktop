/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    var Steps = {
        INSTALL_SIGNAL: 2,
        SCAN_QR_CODE: 3,
        ENTER_NAME: 4,
        PROGRESS_BAR: 5,
        TOO_MANY_DEVICES: 'TooManyDevices',
        NETWORK_ERROR: 'NetworkError',
    };

    Whisper.InstallView = Whisper.View.extend({
        templateName: 'install_flow_template',
        className: 'main install',
        render_attributes: function() {
            var twitterHref = 'https://twitter.com/whispersystems';
            var signalHref = 'https://signal.org/install';
            return {
                installWelcome: i18n('installWelcome'),
                installTagline: i18n('installTagline'),
                installGetStartedButton: i18n('installGetStartedButton'),
                installSignalLink: this.i18n_with_links('installSignalLink', signalHref),
                installIHaveSignalButton: i18n('installGotIt'),
                installFollowUs: this.i18n_with_links('installFollowUs', twitterHref),
                installAndroidInstructions: i18n('installAndroidInstructions'),
                installLinkingWithNumber: i18n('installLinkingWithNumber'),
                installComputerName: i18n('installComputerName'),
                installFinalButton: i18n('installFinalButton'),
                installTooManyDevices: i18n('installTooManyDevices'),
                installConnectionFailed: i18n('installConnectionFailed'),
                ok: i18n('ok'),
                tryAgain: i18n('tryAgain'),
                development: window.config.environment === 'development'
            };
        },
        initialize: function(options) {
            this.counter = 0;

            this.render();

            var deviceName = textsecure.storage.user.getDeviceName();
            if (!deviceName) {
                if (navigator.userAgent.match('Mac OS')) {
                    deviceName = 'Mac';
                } else if (navigator.userAgent.match('Linux')) {
                    deviceName = 'Linux';
                } else if (navigator.userAgent.match('Windows')) {
                    deviceName = 'Windows';
                }
            }

            this.$('#device-name').val(deviceName);
            this.selectStep(Steps.INSTALL_SIGNAL);
            this.connect();
            this.on('disconnected', this.reconnect);

            if (Whisper.Registration.everDone()) {
                this.selectStep(Steps.SCAN_QR_CODE);
                this.hideDots();
            }
        },
        connect: function() {
            this.clearQR();
            var accountManager = getAccountManager();
            accountManager.registerSecondDevice(
                this.setProvisioningUrl.bind(this),
                this.confirmNumber.bind(this),
                this.incrementCounter.bind(this)
            ).catch(this.handleDisconnect.bind(this));
        },
        handleDisconnect: function(e) {
            if (this.canceled) {
                return;
            }
            console.log('provisioning failed', e.stack);

            if (e.message === 'websocket closed') {
                this.showConnectionError();
                this.trigger('disconnected');
            } else if (e.name === 'HTTPError' && e.code == -1) {
                this.selectStep(Steps.NETWORK_ERROR);
            } else if (e.name === 'HTTPError' && e.code == 411) {
                this.showTooManyDevices();
            } else {
                throw e;
            }
        },
        reconnect: function() {
            setTimeout(this.connect.bind(this), 10000);
        },
        events: function() {
            return {
                'click .error-dialog .ok': 'connect',
                'click .step1': 'onCancel',
                'click .step2': this.selectStep.bind(this, Steps.INSTALL_SIGNAL),
                'click .step3': this.selectStep.bind(this, Steps.SCAN_QR_CODE)
            };
        },
        onCancel: function() {
            this.canceled = true;
            this.trigger('cancel');
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
            var stepId = '#step' + Steps.ENTER_NAME;
            this.$(stepId + ' .number').text(libphonenumber.format(
                parsed,
                libphonenumber.PhoneNumberFormat.INTERNATIONAL
            ));
            this.selectStep(Steps.ENTER_NAME);
            this.$('#device-name').focus();
            return new Promise(function(resolve, reject) {
                this.$(stepId + ' .cancel').click(function(e) {
                    reject();
                });
                this.$(stepId).submit(function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    var name = this.$('#device-name').val();
                    name = name.replace(/\0/g,''); // strip unicode null
                    if (name.trim().length === 0) {
                        this.$('#device-name').focus();
                        return;
                    }
                    this.$('.progress-dialog .status').text(i18n('installGeneratingKeys'));
                    this.selectStep(Steps.PROGRESS_BAR);
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
            this.selectStep(Steps.TOO_MANY_DEVICES);
        },
        showConnectionError: function() {
            this.$('#qr').text(i18n("installConnectionFailed"));
        },
        hideDots: function() {
            this.$('#step' + Steps.SCAN_QR_CODE + ' .nav .dot').hide();
        }
    });
})();
