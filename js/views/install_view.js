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

    var DEVICE_NAME_SELECTOR = 'input.device-name';
    var CONNECTION_ERROR = -1;
    var TOO_MANY_DEVICES = 411;

    Whisper.InstallView = Whisper.View.extend({
        templateName: 'link-flow-template',
        className: 'main full-screen-flow',
        events: {
            'click .try-again': 'connect',
            'click .finish': 'finishLinking',
            // the actual next step happens in confirmNumber() on submit form #link-phone
        },
        initialize: function(options) {
            options = options || {};

            this.selectStep(Steps.SCAN_QR_CODE);
            this.connect();
            this.on('disconnected', this.reconnect);

            // Keep data around if it's a re-link, or the middle of a light import
            this.shouldRetainData = Whisper.Registration.everDone() || options.hasExistingData;
        },
        render_attributes: function() {
            var errorMessage;

            if (this.error) {
                if (this.error.name === 'HTTPError'
                    && this.error.code == TOO_MANY_DEVICES) {

                    errorMessage = i18n('installTooManyDevices');
                }
                else if (this.error.name === 'HTTPError'
                    && this.error.code == CONNECTION_ERROR) {

                    errorMessage = i18n('installConnectionFailed');
                }
                else if (this.error.message === 'websocket closed') {
                    // AccountManager.registerSecondDevice uses this specific
                    //   'websocket closed' error message
                    errorMessage = i18n('installConnectionFailed');
                }

                return {
                    isError: true,
                    errorHeader: 'Something went wrong!',
                    errorMessage,
                    errorButton: 'Try again',
                };
            }

            return {
                isStep3: this.step === Steps.SCAN_QR_CODE,
                linkYourPhone: i18n('linkYourPhone'),
                signalSettings: i18n('signalSettings'),
                linkedDevices: i18n('linkedDevices'),
                androidFinalStep: i18n('plusButton'),
                appleFinalStep: i18n('linkNewDevice'),

                isStep4: this.step === Steps.ENTER_NAME,
                chooseName: i18n('chooseDeviceName'),
                finishLinkingPhoneButton: i18n('finishLinkingPhone'),

                isStep5: this.step === Steps.PROGRESS_BAR,
                syncing: i18n('initialSync'),
            };
        },
        selectStep: function(step) {
            this.step = step;
            this.render();
        },
        connect: function() {
            this.error = null;
            this.selectStep(Steps.SCAN_QR_CODE);
            this.clearQR();
            if (this.timeout) {
                clearTimeout(this.timeout);
                this.timeout = null;
            }

            var accountManager = getAccountManager();

            accountManager.registerSecondDevice(
                this.setProvisioningUrl.bind(this),
                this.confirmNumber.bind(this)
            ).catch(this.handleDisconnect.bind(this));
        },
        handleDisconnect: function(e) {
            console.log('provisioning failed', e.stack);

            this.error = e;
            this.render();

            if (e.message === 'websocket closed') {
                this.trigger('disconnected');
            } else if (e.name !== 'HTTPError'
                || (e.code !== CONNECTION_ERROR && e.code !== TOO_MANY_DEVICES)) {

                throw e;
            }
        },
        reconnect: function() {
            if (this.timeout) {
                clearTimeout(this.timeout);
                this.timeout = null;
            }
            this.timeout = setTimeout(this.connect.bind(this), 10000);
        },
        clearQR: function() {
            this.$('#qr img').remove();
            this.$('#qr canvas').remove();
            this.$('#qr .container').show();
            this.$('#qr').removeClass('ready');
        },
        setProvisioningUrl: function(url) {
            if ($('#qr').length === 0) {
                console.log('Did not find #qr element in the DOM!');
                return;
            }

            this.$('#qr .container').hide();
            this.qr = new QRCode(this.$('#qr')[0]).makeCode(url);
            this.$('#qr').removeAttr('title');
            this.$('#qr').addClass('ready');
        },
        setDeviceNameDefault: function() {
            var deviceName = textsecure.storage.user.getDeviceName();

            this.$(DEVICE_NAME_SELECTOR).val(deviceName || window.config.hostname);
            this.$(DEVICE_NAME_SELECTOR).focus();
        },
        finishLinking: function() {
            // We use a form so we get submit-on-enter behavior
            this.$('#link-phone').submit();
        },
        confirmNumber: function(number) {
            var tsp = textsecure.storage.protocol;

            window.removeSetupMenuItems();
            this.selectStep(Steps.ENTER_NAME);
            this.setDeviceNameDefault();

            return new Promise(function(resolve, reject) {
                this.$('#link-phone').submit(function(e) {
                    e.stopPropagation();
                    e.preventDefault();

                    var name = this.$(DEVICE_NAME_SELECTOR).val();
                    name = name.replace(/\0/g,''); // strip unicode null
                    if (name.trim().length === 0) {
                        this.$(DEVICE_NAME_SELECTOR).focus();
                        return;
                    }

                    this.selectStep(Steps.PROGRESS_BAR);

                    var finish = function() {
                        resolve(name);
                    };

                    // Delete all data from database unless we're in the middle
                    //   of a re-link, or we are finishing a light import. Without this,
                    //   app restarts at certain times can cause weird things to happen,
                    //   like data from a previous incomplete light import showing up
                    //   after a new install.
                    if (this.shouldRetainData) {
                        return finish();
                    }

                    tsp.removeAllData().then(finish, function(error) {
                        console.log(
                          'confirmNumber: error clearing database',
                          error && error.stack ? error.stack : error
                        );
                        finish();
                    });
                }.bind(this));
            }.bind(this));
        },
    });
})();
