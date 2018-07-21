describe('Protocol Wrapper', function() {
  const store = textsecure.storage.protocol;
  const identifier = '+5558675309';
  const another_identifier = '+5555590210';
  let prekeys, identityKey, testKey;
  this.timeout(5000);
  before(done => {
    localStorage.clear();
    libsignal.KeyHelper.generateIdentityKeyPair()
      .then(identityKey =>
        textsecure.storage.protocol.saveIdentity(identifier, identityKey)
      )
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
