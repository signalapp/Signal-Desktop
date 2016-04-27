/*
 * vim: ts=4:sw=4:expandtab
 */

'use strict';

describe('Protocol Wrapper', function() {
    var store = textsecure.storage.protocol;
    var identifier = '+5558675309';
    var another_identifier = '+5555590210';
    var prekeys, identityKey, testKey;
    this.timeout(5000);
    before(function(done) {
        localStorage.clear();
        libsignal.util.generateIdentityKeyPair().then(function(identityKey) {
            return textsecure.storage.protocol.putIdentityKey(identifier, identityKey);
        }).then(done);
    });
    describe('processPreKey', function() {
        it('rejects if the identity key changes', function(done) {
            return textsecure.protocol_wrapper.processPreKey({
                identityKey: textsecure.crypto.getRandomBytes(33),
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
