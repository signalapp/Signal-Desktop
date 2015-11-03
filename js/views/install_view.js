/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.InstallView = Whisper.View.extend({
        initialize: function(options) {
            this.counter = 0;
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
            this.$('#qr').text("Connecting...");
        },
        setProvisioningUrl: function(url) {
                this.$('#qr').html('');
                new QRCode(this.$('#qr')[0]).makeCode(url);
        },
        confirmNumber: function(number) {
            this.$('#step4 .number').text(libphonenumber.format(
                libphonenumber.parse(number),
                libphonenumber.PhoneNumberFormat.INTERNATIONAL
            ));
            this.selectStep(4);
            this.$('#device-name').focus();
            return new Promise(function(resolve, reject) {
                this.$('#step4 .cancel').click(function(e) {
                    reject();
                });
                this.$('#sync').click(function(e) {
                    e.stopPropagation();
                    var name = this.$('#device-name').val();
                    if (name.trim().length === 0) {
                        this.$('#device-name').focus();
                        return;
                    }
                    this.$('.progress-dialog .status').text('Generating Keys');
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
            this.$('.progress-dialog .status').text('Syncing groups and contacts');
            this.$('.progress-dialog .bar').addClass('progress-bar-striped active');
        },
        showTooManyDevices: function() {
            this.selectStep('TooManyDevices');
        }
    });
})();
