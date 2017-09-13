(function() {
'use strict';

function ProvisioningCipher() {}

ProvisioningCipher.prototype = {
    decrypt: function(provisionEnvelope) {
        var masterEphemeral = provisionEnvelope.publicKey.toArrayBuffer();
        var message = provisionEnvelope.body.toArrayBuffer();
        if (new Uint8Array(message)[0] != 1) {
            throw new Error("Bad version number on ProvisioningMessage");
        }

        var iv = message.slice(1, 16 + 1);
        var mac = message.slice(message.byteLength - 32, message.byteLength);
        var ivAndCiphertext = message.slice(0, message.byteLength - 32);
        var ciphertext = message.slice(16 + 1, message.byteLength - 32);

        return libsignal.Curve.async.calculateAgreement(
            masterEphemeral, this.keyPair.privKey
        ).then(function(ecRes) {
            return libsignal.HKDF.deriveSecrets(
                ecRes, new ArrayBuffer(32), "TextSecure Provisioning Message"
            );
        }).then(function(keys) {
            return libsignal.crypto.verifyMAC(ivAndCiphertext, keys[1], mac, 32).then(function() {
                return libsignal.crypto.decrypt(keys[0], ciphertext, iv);
            });
        }).then(function(plaintext) {
            var provisionMessage = textsecure.protobuf.ProvisionMessage.decode(plaintext);
            var privKey = provisionMessage.identityKeyPrivate.toArrayBuffer();

            return libsignal.Curve.async.createKeyPair(privKey).then(function(keyPair) {
                var ret = {
                    identityKeyPair  : keyPair,
                    number           : provisionMessage.number,
                    provisioningCode : provisionMessage.provisioningCode,
                    userAgent        : provisionMessage.userAgent,
                };
                if (provisionMessage.profileKey) {
                  ret.profileKey = provisionMessage.profileKey.toArrayBuffer();
                }
                return ret;
            });
        });
    },
    getPublicKey: function() {
      return Promise.resolve().then(function() {
          if (!this.keyPair) {
              return libsignal.Curve.async.generateKeyPair().then(function(keyPair) {
                  this.keyPair = keyPair;
              }.bind(this));
          }
      }.bind(this)).then(function() {
          return this.keyPair.pubKey;
      }.bind(this));
    }
};

libsignal.ProvisioningCipher = function() {
    var cipher = new ProvisioningCipher();

    this.decrypt      = cipher.decrypt.bind(cipher);
    this.getPublicKey = cipher.getPublicKey.bind(cipher);
};

})();
