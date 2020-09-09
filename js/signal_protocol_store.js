/* global
   dcodeIO, Backbone, _, libsignal, textsecure, ConversationController, stringObject */

/* eslint-disable no-proto */

// eslint-disable-next-line func-names
(function() {
  const TIMESTAMP_THRESHOLD = 5 * 1000; // 5 seconds
  const Direction = {
    SENDING: 1,
    RECEIVING: 2,
  };

  const VerifiedStatus = {
    DEFAULT: 0,
    VERIFIED: 1,
    UNVERIFIED: 2,
  };

  function validateVerifiedStatus(status) {
    if (
      status === VerifiedStatus.DEFAULT ||
      status === VerifiedStatus.VERIFIED ||
      status === VerifiedStatus.UNVERIFIED
    ) {
      return true;
    }
    return false;
  }

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
      'verified',
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
      if (!validateVerifiedStatus(attrs.verified)) {
        return new Error('Invalid identity key verified');
      }
      if (typeof attrs.nonblockingApproval !== 'boolean') {
        return new Error('Invalid identity key nonblockingApproval');
      }

      return null;
    },
  });

  async function normalizeEncodedAddress(encodedAddress) {
    const [identifier, deviceId] = textsecure.utils.unencodeNumber(
      encodedAddress
    );
    try {
      const conv = ConversationController.getOrCreate(identifier, 'private');
      return `${conv.get('id')}.${deviceId}`;
    } catch (e) {
      window.log.error(
        `could not get conversation for identifier ${identifier}`
      );
      throw e;
    }
  }

  function SignalProtocolStore() {
    this.sessionUpdateBatcher = window.Signal.Util.createBatcher({
      wait: 500,
      maxSize: 20,
      processBatch: async items => {
        // We only care about the most recent update for each session
        const byId = _.groupBy(items, item => item.id);
        const ids = Object.keys(byId);
        const mostRecent = ids.map(id => _.last(byId[id]));

        await window.Signal.Data.createOrUpdateSessions(mostRecent);
      },
    });
  }

  async function _hydrateCache(object, field, itemsPromise, idField) {
    const items = await itemsPromise;

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
        (async () => {
          const item = await window.Signal.Data.getItemById('identityKey');
          this.ourIdentityKey = item ? item.value : undefined;
        })(),
        (async () => {
          const item = await window.Signal.Data.getItemById('registrationId');
          this.ourRegistrationId = item ? item.value : undefined;
        })(),
        _hydrateCache(
          this,
          'identityKeys',
          window.Signal.Data.getAllIdentityKeys(),
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
          window.Signal.Data.getAllPreKeys(),
          'id'
        ),
        _hydrateCache(
          this,
          'signedPreKeys',
          window.Signal.Data.getAllSignedPreKeys(),
          'id'
        ),
      ]);
    },

    async getIdentityKeyPair() {
      return this.ourIdentityKey;
    },
    async getLocalRegistrationId() {
      return this.ourRegistrationId;
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

      window.log.error('Failed to fetch prekey:', keyId);
      return undefined;
    },
    async storePreKey(keyId, keyPair) {
      const data = {
        id: keyId,
        publicKey: keyPair.pubKey,
        privateKey: keyPair.privKey,
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
      }));
    },
    async storeSignedPreKey(keyId, keyPair, confirmed) {
      const data = {
        id: keyId,
        publicKey: keyPair.pubKey,
        privateKey: keyPair.privKey,
        created_at: Date.now(),
        confirmed: Boolean(confirmed),
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

    async loadSession(encodedAddress) {
      if (encodedAddress === null || encodedAddress === undefined) {
        throw new Error('Tried to get session for undefined/null number');
      }

      try {
        const id = await normalizeEncodedAddress(encodedAddress);
        const session = this.sessions[id];

        if (session) {
          return session.record;
        }
      } catch (e) {
        window.log.error(`could not load session ${encodedAddress}`);
      }

      return undefined;
    },
    async storeSession(encodedAddress, record) {
      if (encodedAddress === null || encodedAddress === undefined) {
        throw new Error('Tried to put session for undefined/null number');
      }
      const unencoded = textsecure.utils.unencodeNumber(encodedAddress);
      const deviceId = parseInt(unencoded[1], 10);

      try {
        const id = await normalizeEncodedAddress(encodedAddress);

        const data = {
          id,
          conversationId: textsecure.utils.unencodeNumber(id)[0],
          deviceId,
          record,
        };

        this.sessions[id] = data;

        // Note: Because these are cached in memory, we batch and make these database
        //   updates out of band.
        this.sessionUpdateBatcher.add(data);
      } catch (e) {
        window.log.error(`could not store session for ${encodedAddress}`);
      }
    },
    async getDeviceIds(identifier) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to get device ids for undefined/null number');
      }

      try {
        const id = ConversationController.getConversationId(identifier);
        const allSessions = Object.values(this.sessions);
        const sessions = allSessions.filter(
          session => session.conversationId === id
        );

        return _.pluck(sessions, 'deviceId');
      } catch (e) {
        window.log.error(
          `could not get device ids for identifier ${identifier}`
        );
      }

      return [];
    },
    async removeSession(encodedAddress) {
      window.log.info('deleting session for ', encodedAddress);
      try {
        const id = await normalizeEncodedAddress(encodedAddress);
        delete this.sessions[id];
        await window.Signal.Data.removeSessionById(id);
      } catch (e) {
        window.log.error(`could not delete session for ${encodedAddress}`);
      }
    },
    async removeAllSessions(identifier) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to remove sessions for undefined/null number');
      }

      const id = ConversationController.getConversationId(identifier);

      const allSessions = Object.values(this.sessions);

      for (let i = 0, max = allSessions.length; i < max; i += 1) {
        const session = allSessions[i];
        if (session.conversationId === id) {
          delete this.sessions[session.id];
        }
      }

      await window.Signal.Data.removeSessionsByConversation(identifier);
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
    async archiveAllSessions(identifier) {
      const deviceIds = await this.getDeviceIds(identifier);

      await Promise.all(
        deviceIds.map(async deviceId => {
          const address = new libsignal.SignalProtocolAddress(
            identifier,
            deviceId
          );
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

    getIdentityRecord(identifier) {
      try {
        const id = ConversationController.getConversationId(identifier);
        const record = this.identityKeys[id];

        if (record) {
          return record;
        }
      } catch (e) {
        window.log.error(
          `could not get identity record for identifier ${identifier}`
        );
      }

      return undefined;
    },

    async isTrustedIdentity(encodedAddress, publicKey, direction) {
      if (encodedAddress === null || encodedAddress === undefined) {
        throw new Error('Tried to get identity key for undefined/null key');
      }
      const identifier = textsecure.utils.unencodeNumber(encodedAddress)[0];
      const ourNumber = textsecure.storage.user.getNumber();
      const ourUuid = textsecure.storage.user.getUuid();
      const isOurIdentifier =
        (ourNumber && identifier === ourNumber) ||
        (ourUuid && identifier === ourUuid);

      const identityRecord = this.getIdentityRecord(identifier);

      if (isOurIdentifier) {
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
      const id = textsecure.utils.unencodeNumber(identifier)[0];
      const identityRecord = this.getIdentityRecord(id);

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
    async saveIdentity(encodedAddress, publicKey, nonblockingApproval) {
      if (encodedAddress === null || encodedAddress === undefined) {
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

      const identifier = textsecure.utils.unencodeNumber(encodedAddress)[0];
      const identityRecord = this.getIdentityRecord(identifier);
      const id = ConversationController.getOrCreate(identifier, 'private').get(
        'id'
      );

      if (!identityRecord || !identityRecord.publicKey) {
        // Lookup failed, or the current key was removed, so save this one.
        window.log.info('Saving new identity...');
        await this._saveIdentityKey({
          id,
          publicKey,
          firstUse: true,
          timestamp: Date.now(),
          verified: VerifiedStatus.DEFAULT,
          nonblockingApproval,
        });

        return false;
      }

      const oldpublicKey = identityRecord.publicKey;
      if (!equalArrayBuffers(oldpublicKey, publicKey)) {
        window.log.info('Replacing existing identity...');
        const previousStatus = identityRecord.verified;
        let verifiedStatus;
        if (
          previousStatus === VerifiedStatus.VERIFIED ||
          previousStatus === VerifiedStatus.UNVERIFIED
        ) {
          verifiedStatus = VerifiedStatus.UNVERIFIED;
        } else {
          verifiedStatus = VerifiedStatus.DEFAULT;
        }

        await this._saveIdentityKey({
          id,
          publicKey,
          firstUse: false,
          timestamp: Date.now(),
          verified: verifiedStatus,
          nonblockingApproval,
        });

        try {
          this.trigger('keychange', identifier);
        } catch (error) {
          window.log.error(
            'saveIdentity error triggering keychange:',
            error && error.stack ? error.stack : error
          );
        }
        await this.archiveSiblingSessions(encodedAddress);

        return true;
      }
      if (this.isNonBlockingApprovalRequired(identityRecord)) {
        window.log.info('Setting approval status...');

        identityRecord.nonblockingApproval = nonblockingApproval;
        await this._saveIdentityKey(identityRecord);

        return false;
      }

      return false;
    },
    isNonBlockingApprovalRequired(identityRecord) {
      return (
        !identityRecord.firstUse &&
        Date.now() - identityRecord.timestamp < TIMESTAMP_THRESHOLD &&
        !identityRecord.nonblockingApproval
      );
    },
    async saveIdentityWithAttributes(encodedAddress, attributes) {
      if (encodedAddress === null || encodedAddress === undefined) {
        throw new Error('Tried to put identity key for undefined/null key');
      }

      const identifier = textsecure.utils.unencodeNumber(encodedAddress)[0];
      const identityRecord = this.getIdentityRecord(identifier);
      const conv = ConversationController.getOrCreate(identifier, 'private');
      const id = conv.get('id');

      const updates = {
        id,
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
    async setApproval(encodedAddress, nonblockingApproval) {
      if (encodedAddress === null || encodedAddress === undefined) {
        throw new Error('Tried to set approval for undefined/null identifier');
      }
      if (typeof nonblockingApproval !== 'boolean') {
        throw new Error('Invalid approval status');
      }

      const identifier = textsecure.utils.unencodeNumber(encodedAddress)[0];
      const identityRecord = this.getIdentityRecord(identifier);

      if (!identityRecord) {
        throw new Error(`No identity record for ${identifier}`);
      }

      identityRecord.nonblockingApproval = nonblockingApproval;
      await this._saveIdentityKey(identityRecord);
    },
    async setVerified(encodedAddress, verifiedStatus, publicKey) {
      if (encodedAddress === null || encodedAddress === undefined) {
        throw new Error('Tried to set verified for undefined/null key');
      }
      if (!validateVerifiedStatus(verifiedStatus)) {
        throw new Error('Invalid verified status');
      }
      if (arguments.length > 2 && !(publicKey instanceof ArrayBuffer)) {
        throw new Error('Invalid public key');
      }

      const identityRecord = this.getIdentityRecord(encodedAddress);

      if (!identityRecord) {
        throw new Error(`No identity record for ${encodedAddress}`);
      }

      if (
        !publicKey ||
        equalArrayBuffers(identityRecord.publicKey, publicKey)
      ) {
        identityRecord.verified = verifiedStatus;

        const model = new IdentityRecord(identityRecord);
        if (model.isValid()) {
          await this._saveIdentityKey(identityRecord);
        } else {
          throw identityRecord.validationError;
        }
      } else {
        window.log.info('No identity record for specified publicKey');
      }
    },
    async getVerified(identifier) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to set verified for undefined/null key');
      }

      const identityRecord = this.getIdentityRecord(identifier);
      if (!identityRecord) {
        throw new Error(`No identity record for ${identifier}`);
      }

      const verifiedStatus = identityRecord.verified;
      if (validateVerifiedStatus(verifiedStatus)) {
        return verifiedStatus;
      }

      return VerifiedStatus.DEFAULT;
    },
    // Resolves to true if a new identity key was saved
    processContactSyncVerificationState(identifier, verifiedStatus, publicKey) {
      if (verifiedStatus === VerifiedStatus.UNVERIFIED) {
        return this.processUnverifiedMessage(
          identifier,
          verifiedStatus,
          publicKey
        );
      }
      return this.processVerifiedMessage(identifier, verifiedStatus, publicKey);
    },
    // This function encapsulates the non-Java behavior, since the mobile apps don't
    //   currently receive contact syncs and therefore will see a verify sync with
    //   UNVERIFIED status
    async processUnverifiedMessage(identifier, verifiedStatus, publicKey) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to set verified for undefined/null key');
      }
      if (publicKey !== undefined && !(publicKey instanceof ArrayBuffer)) {
        throw new Error('Invalid public key');
      }

      const identityRecord = this.getIdentityRecord(identifier);

      const isPresent = Boolean(identityRecord);
      let isEqual = false;

      if (isPresent && publicKey) {
        isEqual = equalArrayBuffers(publicKey, identityRecord.publicKey);
      }

      if (
        isPresent &&
        isEqual &&
        identityRecord.verified !== VerifiedStatus.UNVERIFIED
      ) {
        await textsecure.storage.protocol.setVerified(
          identifier,
          verifiedStatus,
          publicKey
        );
        return false;
      }

      if (!isPresent || !isEqual) {
        await textsecure.storage.protocol.saveIdentityWithAttributes(
          identifier,
          {
            publicKey,
            verified: verifiedStatus,
            firstUse: false,
            timestamp: Date.now(),
            nonblockingApproval: true,
          }
        );

        if (isPresent && !isEqual) {
          try {
            this.trigger('keychange', identifier);
          } catch (error) {
            window.log.error(
              'processUnverifiedMessage error triggering keychange:',
              error && error.stack ? error.stack : error
            );
          }

          await this.archiveAllSessions(identifier);

          return true;
        }
      }

      // The situation which could get us here is:
      //   1. had a previous key
      //   2. new key is the same
      //   3. desired new status is same as what we had before
      return false;
    },
    // This matches the Java method as of
    //   https://github.com/signalapp/Signal-Android/blob/d0bb68e1378f689e4d10ac6a46014164992ca4e4/src/org/thoughtcrime/securesms/util/IdentityUtil.java#L188
    async processVerifiedMessage(identifier, verifiedStatus, publicKey) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to set verified for undefined/null key');
      }
      if (!validateVerifiedStatus(verifiedStatus)) {
        throw new Error('Invalid verified status');
      }
      if (publicKey !== undefined && !(publicKey instanceof ArrayBuffer)) {
        throw new Error('Invalid public key');
      }

      const identityRecord = this.getIdentityRecord(identifier);

      const isPresent = Boolean(identityRecord);
      let isEqual = false;

      if (isPresent && publicKey) {
        isEqual = equalArrayBuffers(publicKey, identityRecord.publicKey);
      }

      if (!isPresent && verifiedStatus === VerifiedStatus.DEFAULT) {
        window.log.info('No existing record for default status');
        return false;
      }

      if (
        isPresent &&
        isEqual &&
        identityRecord.verified !== VerifiedStatus.DEFAULT &&
        verifiedStatus === VerifiedStatus.DEFAULT
      ) {
        await textsecure.storage.protocol.setVerified(
          identifier,
          verifiedStatus,
          publicKey
        );
        return false;
      }

      if (
        verifiedStatus === VerifiedStatus.VERIFIED &&
        (!isPresent ||
          (isPresent && !isEqual) ||
          (isPresent && identityRecord.verified !== VerifiedStatus.VERIFIED))
      ) {
        await textsecure.storage.protocol.saveIdentityWithAttributes(
          identifier,
          {
            publicKey,
            verified: verifiedStatus,
            firstUse: false,
            timestamp: Date.now(),
            nonblockingApproval: true,
          }
        );

        if (isPresent && !isEqual) {
          try {
            this.trigger('keychange', identifier);
          } catch (error) {
            window.log.error(
              'processVerifiedMessage error triggering keychange:',
              error && error.stack ? error.stack : error
            );
          }

          await this.archiveAllSessions(identifier);

          // true signifies that we overwrote a previous key with a new one
          return true;
        }
      }

      // We get here if we got a new key and the status is DEFAULT. If the
      //   message is out of date, we don't want to lose whatever more-secure
      //   state we had before.
      return false;
    },
    async isUntrusted(identifier) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to set verified for undefined/null key');
      }

      const identityRecord = this.getIdentityRecord(identifier);
      if (!identityRecord) {
        throw new Error(`No identity record for ${identifier}`);
      }

      if (
        Date.now() - identityRecord.timestamp < TIMESTAMP_THRESHOLD &&
        !identityRecord.nonblockingApproval &&
        !identityRecord.firstUse
      ) {
        return true;
      }

      return false;
    },
    async removeIdentityKey(identifier) {
      const id = ConversationController.getConversationId(identifier);
      if (id) {
        delete this.identityKeys[id];
        await window.Signal.Data.removeIdentityKeyById(id);
        await textsecure.storage.protocol.removeAllSessions(id);
      }
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
    addMultipleUnprocessed(array) {
      // We need to pass forceSave because the data has an id already, which will cause
      //   an update instead of an insert.
      return window.Signal.Data.saveUnprocesseds(array, {
        forceSave: true,
      });
    },
    updateUnprocessedAttempts(id, attempts) {
      return window.Signal.Data.updateUnprocessedAttempts(id, attempts);
    },
    updateUnprocessedWithData(id, data) {
      return window.Signal.Data.updateUnprocessedWithData(id, data);
    },
    updateUnprocessedsWithData(items) {
      return window.Signal.Data.updateUnprocessedsWithData(items);
    },
    removeUnprocessed(idOrArray) {
      return window.Signal.Data.removeUnprocessed(idOrArray);
    },
    removeAllUnprocessed() {
      return window.Signal.Data.removeAllUnprocessed();
    },
    async removeAllData() {
      await window.Signal.Data.removeAll();
      await this.hydrateCaches();

      window.storage.reset();
      await window.storage.fetch();

      ConversationController.reset();
      await ConversationController.load();
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
  window.SignalProtocolStore.prototype.VerifiedStatus = VerifiedStatus;
})();
