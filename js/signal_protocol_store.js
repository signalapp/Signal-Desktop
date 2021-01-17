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
    async getLocalRegistrationId() {
      const item = await window.Signal.Data.getItemById('registrationId');
      if (item) {
        return item.value;
      }

      return 1;
    },

    // PreKeys

    async loadPreKey(keyId) {
      const key = this.preKeys[keyId];
      if (key) {
        window.log.info('Successfully fetched prekey:', keyId);
        return {
          pubKey: key.publicKey,
          privKey: key.privateKey,
        };
      }

      return undefined;
    },
    async loadPreKeyForContact(contactPubKey) {
      const key = await window.Signal.Data.getPreKeyByRecipient(contactPubKey);

      if (key) {
        window.log.info(
          'Successfully fetched prekey for recipient:',
          contactPubKey
        );
        return {
          pubKey: key.publicKey,
          privKey: key.privateKey,
          keyId: key.id,
          recipient: key.recipient,
        };
      }

      return undefined;
    },
    async storePreKey(keyId, keyPair, contactPubKey) {
      const data = {
        id: keyId,
        publicKey: keyPair.pubKey,
        privateKey: keyPair.privKey,
        recipient: contactPubKey,
      };

      this.preKeys[keyId] = data;
      await window.Signal.Data.createOrUpdatePreKey(data);
    },
    async removePreKey(keyId) {
      try {
        this.trigger('removePreKey');
      } catch (error) {
        window.log.error(
          'removePreKey error triggering removePreKey:',
          error && error.stack ? error.stack : error
        );
      }

      delete this.preKeys[keyId];
      await window.Signal.Data.removePreKeyById(keyId);
    },
    async clearPreKeyStore() {
      this.preKeys = Object.create(null);
      await window.Signal.Data.removeAllPreKeys();
    },

    // Signed PreKeys
    /* Returns a signed keypair object or undefined */
    async loadSignedPreKey(keyId) {
      const key = this.signedPreKeys[keyId];
      if (key) {
        window.log.info('Successfully fetched signed prekey:', key.id);
        return {
          pubKey: key.publicKey,
          privKey: key.privateKey,
          created_at: key.created_at,
          keyId: key.id,
          confirmed: key.confirmed,
          signature: key.signature,
        };
      }

      window.log.error('Failed to fetch signed prekey:', keyId);
      return undefined;
    },
    async loadSignedPreKeys() {
      if (arguments.length > 0) {
        throw new Error('loadSignedPreKeys takes no arguments');
      }

      const keys = Object.values(this.signedPreKeys);
      return keys.map(prekey => ({
        pubKey: prekey.publicKey,
        privKey: prekey.privateKey,
        created_at: prekey.created_at,
        keyId: prekey.id,
        confirmed: prekey.confirmed,
        signature: prekey.signature,
      }));
    },
    async storeSignedPreKey(keyId, keyPair, confirmed, signature) {
      const data = {
        id: keyId,
        publicKey: keyPair.pubKey,
        privateKey: keyPair.privKey,
        created_at: Date.now(),
        confirmed: Boolean(confirmed),
        signature,
      };

      this.signedPreKeys[keyId] = data;
      await window.Signal.Data.createOrUpdateSignedPreKey(data);
    },
    async removeSignedPreKey(keyId) {
      delete this.signedPreKeys[keyId];
      await window.Signal.Data.removeSignedPreKeyById(keyId);
    },
    async clearSignedPreKeysStore() {
      this.signedPreKeys = Object.create(null);
      await window.Signal.Data.removeAllSignedPreKeys();
    },

    // Sessions

    async loadSession(encodedNumber) {
      if (encodedNumber === null || encodedNumber === undefined) {
        throw new Error('Tried to get session for undefined/null number');
      }

      const session = this.sessions[encodedNumber];
      if (session) {
        return session.record;
      }

      return undefined;
    },
    async storeSession(encodedNumber, record) {
      if (encodedNumber === null || encodedNumber === undefined) {
        throw new Error('Tried to put session for undefined/null number');
      }
      const unencoded = textsecure.utils.unencodeNumber(encodedNumber);
      const number = unencoded[0];
      const deviceId = parseInt(unencoded[1], 10);

      const data = {
        id: encodedNumber,
        number,
        deviceId,
        record,
      };

      this.sessions[encodedNumber] = data;
      await window.Signal.Data.createOrUpdateSession(data);
    },
    async getDeviceIds(number) {
      if (number === null || number === undefined) {
        throw new Error('Tried to get device ids for undefined/null number');
      }

      const allSessions = Object.values(this.sessions);
      const sessions = allSessions.filter(session => session.number === number);
      return _.pluck(sessions, 'deviceId');
    },
    async removeAllSessions(number) {
      if (number === null || number === undefined) {
        throw new Error('Tried to remove sessions for undefined/null number');
      }

      const allSessions = Object.values(this.sessions);
      for (let i = 0, max = allSessions.length; i < max; i += 1) {
        const session = allSessions[i];
        if (session.number === number) {
          delete this.sessions[session.id];
        }
      }
      await window.Signal.Data.removeSessionsByNumber(number);
    },
    async archiveSiblingSessions(identifier) {
      const address = libsignal.SignalProtocolAddress.fromString(identifier);

      const deviceIds = await this.getDeviceIds(address.getName());
      const siblings = _.without(deviceIds, address.getDeviceId());

      await Promise.all(
        siblings.map(async deviceId => {
          const sibling = new libsignal.SignalProtocolAddress(
            address.getName(),
            deviceId
          );
          window.log.info('closing session for', sibling.toString());
          const sessionCipher = new libsignal.SessionCipher(
            textsecure.storage.protocol,
            sibling
          );
          await sessionCipher.closeOpenSessionForDevice();
        })
      );
    },
    async archiveAllSessions(number) {
      const deviceIds = await this.getDeviceIds(number);

      await Promise.all(
        deviceIds.map(async deviceId => {
          const address = new libsignal.SignalProtocolAddress(number, deviceId);
          window.log.info('closing session for', address.toString());
          const sessionCipher = new libsignal.SessionCipher(
            textsecure.storage.protocol,
            address
          );
          await sessionCipher.closeOpenSessionForDevice();
        })
      );
    },
    async clearSessionStore() {
      this.sessions = Object.create(null);
      window.Signal.Data.removeAllSessions();
    },

    // Identity Keys

    async isTrustedIdentity(identifier, publicKey, direction) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to get identity key for undefined/null key');
      }
      const number = textsecure.utils.unencodeNumber(identifier)[0];
      const isOurNumber = number === textsecure.storage.user.getNumber();

      const identityRecord = this.identityKeys[number];

      if (isOurNumber) {
        const existing = identityRecord ? identityRecord.publicKey : null;
        return equalArrayBuffers(existing, publicKey);
      }

      switch (direction) {
        case Direction.SENDING:
          return this.isTrustedForSending(publicKey, identityRecord);
        case Direction.RECEIVING:
          return true;
        default:
          throw new Error(`Unknown direction: ${direction}`);
      }
    },
    isTrustedForSending(publicKey, identityRecord) {
      if (!identityRecord) {
        window.log.info(
          'isTrustedForSending: No previous record, returning true...'
        );
        return true;
      }

      const existing = identityRecord.publicKey;

      if (!existing) {
        window.log.info('isTrustedForSending: Nothing here, returning true...');
        return true;
      }
      if (!equalArrayBuffers(existing, publicKey)) {
        window.log.info("isTrustedForSending: Identity keys don't match...");
        return false;
      }
      if (identityRecord.verified === VerifiedStatus.UNVERIFIED) {
        window.log.error('Needs unverified approval!');
        return false;
      }
      if (this.isNonBlockingApprovalRequired(identityRecord)) {
        window.log.error('isTrustedForSending: Needs non-blocking approval!');
        return false;
      }

      return true;
    },
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
