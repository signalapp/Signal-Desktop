/*
  global
  dcodeIO,
  Backbone,
  _,
  libsignal,
  textsecure,
  stringObject,
  BlockedNumberController
*/

/* eslint-disable no-proto */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  const Direction = {
    SENDING: 1,
    RECEIVING: 2,
  };

  const StaticByteBufferProto = new dcodeIO.ByteBuffer().__proto__;
  const StaticArrayBufferProto = new ArrayBuffer().__proto__;
  const StaticUint8ArrayProto = new Uint8Array().__proto__;

  function isStringable(thing) {
    return (
      thing === Object(thing) &&
      (thing.__proto__ === StaticArrayBufferProto ||
        thing.__proto__ === StaticUint8ArrayProto ||
        thing.__proto__ === StaticByteBufferProto)
    );
  }
  function convertToArrayBuffer(thing) {
    if (thing === undefined) {
      return undefined;
    }
    if (thing === Object(thing)) {
      if (thing.__proto__ === StaticArrayBufferProto) {
        return thing;
      }
      // TODO: Several more cases here...
    }

    if (thing instanceof Array) {
      // Assuming Uint16Array from curve25519
      const res = new ArrayBuffer(thing.length * 2);
      const uint = new Uint16Array(res);
      for (let i = 0; i < thing.length; i += 1) {
        uint[i] = thing[i];
      }
      return res;
    }

    let str;
    if (isStringable(thing)) {
      str = stringObject(thing);
    } else if (typeof thing === 'string') {
      str = thing;
    } else {
      throw new Error(
        `Tried to convert a non-stringable thing of type ${typeof thing} to an array buffer`
      );
    }
    const res = new ArrayBuffer(str.length);
    const uint = new Uint8Array(res);
    for (let i = 0; i < str.length; i += 1) {
      uint[i] = str.charCodeAt(i);
    }
    return res;
  }

  function equalArrayBuffers(ab1, ab2) {
    if (!(ab1 instanceof ArrayBuffer && ab2 instanceof ArrayBuffer)) {
      return false;
    }
    if (ab1.byteLength !== ab2.byteLength) {
      return false;
    }
    let result = 0;
    const ta1 = new Uint8Array(ab1);
    const ta2 = new Uint8Array(ab2);
    for (let i = 0; i < ab1.byteLength; i += 1) {
      // eslint-disable-next-line no-bitwise
      result |= ta1[i] ^ ta2[i];
    }
    return result === 0;
  }

  const IdentityRecord = Backbone.Model.extend({
    storeName: 'identityKeys',
    validAttributes: [
      'id',
      'publicKey',
      'firstUse',
      'timestamp',
      'nonblockingApproval',
    ],
    validate(attrs) {
      const attributeNames = _.keys(attrs);
      const { validAttributes } = this;
      const allValid = _.all(attributeNames, attributeName =>
        _.contains(validAttributes, attributeName)
      );
      if (!allValid) {
        return new Error('Invalid identity key attribute names');
      }
      const allPresent = _.all(validAttributes, attributeName =>
        _.contains(attributeNames, attributeName)
      );
      if (!allPresent) {
        return new Error('Missing identity key attributes');
      }

      if (typeof attrs.id !== 'string') {
        return new Error('Invalid identity key id');
      }
      if (!(attrs.publicKey instanceof ArrayBuffer)) {
        return new Error('Invalid identity key publicKey');
      }
      if (typeof attrs.firstUse !== 'boolean') {
        return new Error('Invalid identity key firstUse');
      }
      if (typeof attrs.timestamp !== 'number' || !(attrs.timestamp >= 0)) {
        return new Error('Invalid identity key timestamp');
      }
      if (typeof attrs.nonblockingApproval !== 'boolean') {
        return new Error('Invalid identity key nonblockingApproval');
      }

      return null;
    },
  });

  function SignalProtocolStore() {}

  async function _hydrateCache(object, field, items, idField) {
    const cache = Object.create(null);
    for (let i = 0, max = items.length; i < max; i += 1) {
      const item = items[i];
      const id = item[idField];

      cache[id] = item;
    }

    window.log.info(`SignalProtocolStore: Finished caching ${field} data`);
    // eslint-disable-next-line no-param-reassign
    object[field] = cache;
  }

  SignalProtocolStore.prototype = {
    constructor: SignalProtocolStore,
    async hydrateCaches() {
      await Promise.all([
        _hydrateCache(
          this,
          'identityKeys',
          await window.Signal.Data.getAllIdentityKeys(),
          'id'
        ),
        _hydrateCache(
          this,
          'sessions',
          await window.Signal.Data.getAllSessions(),
          'id'
        ),
        _hydrateCache(
          this,
          'preKeys',
          await window.Signal.Data.getAllPreKeys(),
          'id'
        ),
        _hydrateCache(
          this,
          'signedPreKeys',
          await window.Signal.Data.getAllSignedPreKeys(),
          'id'
        ),
      ]);
    },

    async getIdentityKeyPair() {
      const item = await window.Signal.Data.getItemById('identityKey');
      if (item) {
        return item.value;
      }
      window.log.error('Could not load identityKey from SignalData');
      return undefined;
    },

    // PreKeys

    async clearPreKeyStore() {
      this.preKeys = Object.create(null);
      await window.Signal.Data.removeAllPreKeys();
    },

    // Signed PreKeys
    async clearSignedPreKeysStore() {
      this.signedPreKeys = Object.create(null);
      await window.Signal.Data.removeAllSignedPreKeys();
    },

    // Sessions
    async clearSessionStore() {
      this.sessions = Object.create(null);
      window.Signal.Data.removeAllSessions();
    },

    // Identity Keys

    async loadIdentityKey(identifier) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to get identity key for undefined/null key');
      }
      const number = textsecure.utils.unencodeNumber(identifier)[0];
      const identityRecord = this.identityKeys[number];

      if (identityRecord) {
        return identityRecord.publicKey;
      }

      return undefined;
    },
    async _saveIdentityKey(data) {
      const { id } = data;
      this.identityKeys[id] = data;
      await window.Signal.Data.createOrUpdateIdentityKey(data);
    },
    async saveIdentity(identifier, publicKey, nonblockingApproval) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to put identity key for undefined/null key');
      }
      if (!(publicKey instanceof ArrayBuffer)) {
        // eslint-disable-next-line no-param-reassign
        publicKey = convertToArrayBuffer(publicKey);
      }
      if (typeof nonblockingApproval !== 'boolean') {
        // eslint-disable-next-line no-param-reassign
        nonblockingApproval = false;
      }

      const number = textsecure.utils.unencodeNumber(identifier)[0];
      const identityRecord = this.identityKeys[number];

      if (!identityRecord || !identityRecord.publicKey) {
        // Lookup failed, or the current key was removed, so save this one.
        window.log.info('Saving new identity...');
        await this._saveIdentityKey({
          id: number,
          publicKey,
          firstUse: true,
          timestamp: Date.now(),
          nonblockingApproval,
        });

        return false;
      }

      const oldpublicKey = identityRecord.publicKey;
      if (!equalArrayBuffers(oldpublicKey, publicKey)) {
        window.log.info('Replacing existing identity...');

        await this._saveIdentityKey({
          id: number,
          publicKey,
          firstUse: false,
          timestamp: Date.now(),
          nonblockingApproval,
        });

        return true;
      }

      return false;
    },
    async saveIdentityWithAttributes(identifier, attributes) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to put identity key for undefined/null key');
      }

      const number = textsecure.utils.unencodeNumber(identifier)[0];
      const identityRecord = this.identityKeys[number];

      const updates = {
        id: number,
        ...identityRecord,
        ...attributes,
      };

      const model = new IdentityRecord(updates);
      if (model.isValid()) {
        await this._saveIdentityKey(updates);
      } else {
        throw model.validationError;
      }
    },
    async setApproval(identifier, nonblockingApproval) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to set approval for undefined/null identifier');
      }
      if (typeof nonblockingApproval !== 'boolean') {
        throw new Error('Invalid approval status');
      }

      const number = textsecure.utils.unencodeNumber(identifier)[0];
      const identityRecord = this.identityKeys[number];

      if (!identityRecord) {
        throw new Error(`No identity record for ${number}`);
      }

      identityRecord.nonblockingApproval = nonblockingApproval;
      await this._saveIdentityKey(identityRecord);
    },
    async removeIdentityKey(number) {
      delete this.identityKeys[number];
      await window.Signal.Data.removeIdentityKeyById(number);
    },

    // Not yet processed messages - for resiliency
    getUnprocessedCount() {
      return window.Signal.Data.getUnprocessedCount();
    },
    getAllUnprocessed() {
      return window.Signal.Data.getAllUnprocessed();
    },
    getUnprocessedById(id) {
      return window.Signal.Data.getUnprocessedById(id);
    },
    addUnprocessed(data) {
      // We need to pass forceSave because the data has an id already, which will cause
      //   an update instead of an insert.
      return window.Signal.Data.saveUnprocessed(data, {
        forceSave: true,
      });
    },
    updateUnprocessedAttempts(id, attempts) {
      return window.Signal.Data.updateUnprocessedAttempts(id, attempts);
    },
    updateUnprocessedWithData(id, data) {
      return window.Signal.Data.updateUnprocessedWithData(id, data);
    },
    removeUnprocessed(id) {
      return window.Signal.Data.removeUnprocessed(id);
    },
    removeAllUnprocessed() {
      return window.Signal.Data.removeAllUnprocessed();
    },
    async removeAllData() {
      await window.Signal.Data.removeAll();
      await this.hydrateCaches();

      window.storage.reset();
      await window.storage.fetch();

      window.getConversationController().reset();
      BlockedNumberController.reset();
      await window.getConversationController().load();
      await BlockedNumberController.load();
    },
    async removeAllConfiguration() {
      await window.Signal.Data.removeAllConfiguration();
      await this.hydrateCaches();

      window.storage.reset();
      await window.storage.fetch();
    },
  };
  _.extend(SignalProtocolStore.prototype, Backbone.Events);

  window.SignalProtocolStore = SignalProtocolStore;
  window.SignalProtocolStore.prototype.Direction = Direction;
})();
