/*
 * vim: ts=4:sw=4:expandtab
 */

'use strict';

describe('Device storage', function() {
    before(function() { localStorage.clear(); });
    var store = textsecure.storage.protocol;
    var identifier = '+5558675309';
    var another_identifier = '+5555590210';
    var identityKey = {
        pubKey: textsecure.crypto.getRandomBytes(33),
        privKey: textsecure.crypto.getRandomBytes(32),
    };
    var testKey = {
        pubKey: textsecure.crypto.getRandomBytes(33),
        privKey: textsecure.crypto.getRandomBytes(32),
    };
    describe('saveKeysToDeviceObject', function() {
        it('rejects if the identity key changes', function(done) {
            return textsecure.storage.devices.saveKeysToDeviceObject({
                identityKey: identityKey.pubKey,
                encodedNumber: identifier + '.1'
            }).then(function() {
                textsecure.storage.devices.saveKeysToDeviceObject({
                    identityKey: testKey.pubKey,
                    encodedNumber: identifier + '.1'
                }).then(function() {
                    done(new Error('Allowed to overwrite identity key'));
                }).catch(function(e) {
                    assert.strictEqual(e.message, 'Identity key changed');
                    done();
                });
            });
        });
    });
});
