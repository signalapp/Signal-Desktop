function SignalProtocolStore() {
  this.store = {};
}

SignalProtocolStore.prototype = {
  Direction: { SENDING: 1, RECEIVING: 2 },
  getIdentityKeyPair() {
    return Promise.resolve(this.get('identityKey'));
  },
  getLocalRegistrationId() {
    return Promise.resolve(this.get('registrationId'));
  },
  put(key, value) {
    if (
      key === undefined ||
      value === undefined ||
      key === null ||
      value === null
    )
      throw new Error('Tried to store undefined/null');
    this.store[key] = value;
  },
  get(key, defaultValue) {
    if (key === null || key === undefined)
      throw new Error('Tried to get value for undefined/null key');
    if (key in this.store) {
      return this.store[key];
    }
    return defaultValue;
  },
  remove(key) {
    if (key === null || key === undefined)
      throw new Error('Tried to remove value for undefined/null key');
    delete this.store[key];
  },

  isTrustedIdentity(identifier, identityKey) {
    if (identifier === null || identifier === undefined) {
      throw new Error('tried to check identity key for undefined/null key');
    }
    if (!(identityKey instanceof ArrayBuffer)) {
      throw new Error('Expected identityKey to be an ArrayBuffer');
    }
    const trusted = this.get(`identityKey${identifier}`);
    if (trusted === undefined) {
      return Promise.resolve(true);
    }
    return Promise.resolve(identityKey === trusted);
  },
  loadIdentityKey(identifier) {
    if (identifier === null || identifier === undefined)
      throw new Error('Tried to get identity key for undefined/null key');
    return new Promise(resolve => {
      resolve(this.get(`identityKey${identifier}`));
    });
  },
  saveIdentity(identifier, identityKey) {
    if (identifier === null || identifier === undefined)
      throw new Error('Tried to put identity key for undefined/null key');
    return new Promise(resolve => {
      const existing = this.get(`identityKey${identifier}`);
      this.put(`identityKey${identifier}`, identityKey);
      if (existing && existing !== identityKey) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  },

  /* Returns a prekeypair object or undefined */
  loadPreKey(keyId) {
    return new Promise(resolve => {
      const res = this.get(`25519KeypreKey${keyId}`);
      resolve(res);
    });
  },
  storePreKey(keyId, keyPair) {
    return new Promise(resolve => {
      resolve(this.put(`25519KeypreKey${keyId}`, keyPair));
    });
  },
  removePreKey(keyId) {
    return new Promise(resolve => {
      resolve(this.remove(`25519KeypreKey${keyId}`));
    });
  },

  /* Returns a signed keypair object or undefined */
  loadSignedPreKey(keyId) {
    return new Promise(resolve => {
      const res = this.get(`25519KeysignedKey${keyId}`);
      resolve(res);
    });
  },
  loadSignedPreKeys() {
    return new Promise(resolve => {
      const res = [];
      const keys = Object.keys(this.store);
      for (let i = 0, max = keys.length; i < max; i += 1) {
        const key = keys[i];
        if (key.startsWith('25519KeysignedKey')) {
          res.push(this.store[key]);
        }
      }
      resolve(res);
    });
  },
  storeSignedPreKey(keyId, keyPair) {
    return new Promise(resolve => {
      resolve(this.put(`25519KeysignedKey${keyId}`, keyPair));
    });
  },
  removeSignedPreKey(keyId) {
    return new Promise(resolve => {
      resolve(this.remove(`25519KeysignedKey${keyId}`));
    });
  },

  loadSession(identifier) {
    return new Promise(resolve => {
      resolve(this.get(`session${identifier}`));
    });
  },
  storeSession(identifier, record) {
    return new Promise(resolve => {
      resolve(this.put(`session${identifier}`, record));
    });
  },
  removeAllSessions(identifier) {
    return new Promise(resolve => {
      const keys = Object.keys(this.store);
      for (let i = 0, max = keys.length; i < max; i += 1) {
        const key = keys[i];
        if (key.match(RegExp(`^session${identifier.replace('+', '\\+')}.+`))) {
          delete this.store[key];
        }
      }
      resolve();
    });
  },
  getDeviceIds(identifier) {
    return new Promise(resolve => {
      const deviceIds = [];
      const keys = Object.keys(this.store);
      for (let i = 0, max = keys.length; i < max; i += 1) {
        const key = keys[i];
        if (key.match(RegExp(`^session${identifier.replace('+', '\\+')}.+`))) {
          deviceIds.push(parseInt(key.split('.')[1], 10));
        }
      }
      resolve(deviceIds);
    });
  },
};
