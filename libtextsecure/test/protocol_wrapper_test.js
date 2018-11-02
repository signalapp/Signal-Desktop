/* global libsignal, textsecure */

describe('Protocol Wrapper', function thisNeeded() {
  const store = textsecure.storage.protocol;
  const identifier = '+5558675309';

  this.timeout(5000);

  before(done => {
    localStorage.clear();
    libsignal.KeyHelper.generateIdentityKeyPair()
      .then(key => textsecure.storage.protocol.saveIdentity(identifier, key))
      .then(() => {
        done();
      });
  });

  describe('processPreKey', () => {
    it('rejects if the identity key changes', () => {
      const address = new libsignal.SignalProtocolAddress(identifier, 1);
      const builder = new libsignal.SessionBuilder(store, address);
      return builder
        .processPreKey({
          identityKey: textsecure.crypto.getRandomBytes(33),
          encodedNumber: address.toString(),
        })
        .then(() => {
          throw new Error('Allowed to overwrite identity key');
        })
        .catch(e => {
          assert.strictEqual(e.message, 'Identity key changed');
        });
    });
  });
});
