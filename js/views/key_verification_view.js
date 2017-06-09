/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    // TODO; find all uses of that removed panel
    // Add the Verify functionality to this view
    Whisper.KeyVerificationView = Whisper.View.extend({
        className: 'key-verification panel',
        templateName: 'key-verification',
        initialize: function(options) {
            this.our_number = textsecure.storage.user.getNumber();
            if (options.newKey) {
              this.their_key = options.newKey;
            }
            Promise.all([
                this.loadTheirKey(),
                this.loadOurKey(),
            ]).then(this.generateSecurityNumber.bind(this))
              .then(this.render.bind(this));
              //.then(this.makeQRCode.bind(this));
        },
        makeQRCode: function() {
            // Per Lilia: We can't turn this on until it geneates a Latin1 string, as is
            //   required by the mobile clients.
            new QRCode(this.$('.qr')[0]).makeCode(
                dcodeIO.ByteBuffer.wrap(this.our_key).toString('base64')
            );
        },
        loadTheirKey: function() {
            if (this.their_key) {
                return Promise.resolve(this.their_key);
            } else {
                return textsecure.storage.protocol.loadIdentityKey(
                    this.model.id
                ).then(function(their_key) {
                    this.their_key = their_key;
                }.bind(this));
            }
        },
        loadOurKey: function() {
            if (this.our_key) {
                return Promise.resolve(this.our_key);
            } else {
                return textsecure.storage.protocol.loadIdentityKey(
                    this.our_number
                ).then(function(our_key) {
                    this.our_key = our_key;
                }.bind(this));
            }
        },
        generateSecurityNumber: function() {
            return new libsignal.FingerprintGenerator(5200).createFor(
                this.our_number, this.our_key, this.model.id, this.their_key
            ).then(function(securityNumber) {
                this.securityNumber = securityNumber;
            }.bind(this));
        },
        render_attributes: function() {
            var s = this.securityNumber;
            var chunks = [];
            for (var i = 0; i < s.length; i += 5) {
                chunks.push(s.substring(i, i+5));
            }
            var yourSafetyNumberWith = i18n(
                'yourSafetyNumberWith', this.model.getTitle()
            );
            return {
                learnMore            : i18n('learnMore'),
                their_key_unknown    : i18n('theirIdentityUnknown'),
                yourSafetyNumberWith : i18n('yourSafetyNumberWith', this.model.getTitle()),
                has_their_key        : this.their_key !== undefined,
                chunks               : chunks,
            };
        }
    });
})();
