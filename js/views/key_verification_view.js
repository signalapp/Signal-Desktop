/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    var SecurityNumberView = Whisper.View.extend({
        className: 'securityNumber',
        templateName: 'security_number',
        initialize: function() {
            this.generateSecurityNumber();
        },
        generateSecurityNumber: function() {
            new libsignal.FingerprintGenerator(5200).createFor(
                this.model.your_number,
                this.model.your_key,
                this.model.their_number,
                this.model.their_key
            ).then(this.handleSecurityNumber.bind(this));
        },
        handleSecurityNumber: function(securityNumber) {
            this.model.securityNumber = securityNumber;
            this.render();
        },
        render_attributes: function() {
            var s = this.model.securityNumber;
            var chunks = [];
            for (var i = 0; i < s.length; i += 5) {
                chunks.push(s.substring(i, i+5));
            }
            return { chunks: chunks };
        }
    });

    Whisper.KeyVerificationView = Whisper.View.extend({
        className: 'key-verification',
        templateName: 'key_verification',
        initialize: function() {
            this.render();
            /*
            this.$('.securityNumber').append(
                new SecurityNumberView({model: this.model}).el
            );
            */
        },
        splitKey: function(key) {
            // key is an array buffer
            var bytes = new Uint8Array(key);
            var octets = [];
            for (var i = 0; i < bytes.byteLength; ++i) {
                octets.push(('0' + bytes[i].toString(16)).slice(-2));
            }

            return octets;
        },
        render_attributes: function() {
            return {
                learnMore    : i18n('learnMore'),
                verifyIdentity: i18n('verifyIdentity'),
                yourIdentity: i18n('yourIdentity'),
                theirIdentity: i18n('theirIdentity'),
                their_key_unknown: i18n('theirIdentityUnknown'),
                your_key: this.splitKey(this.model.your_key),
                their_key: this.splitKey(this.model.their_key),
                has_their_key: this.model.their_key !== undefined
            };
        }
    });
    Whisper.KeyVerificationPanelView = Whisper.KeyVerificationView.extend({
        className: 'key-verification panel',
        templateName: 'key_verification_panel',
    });
})();
