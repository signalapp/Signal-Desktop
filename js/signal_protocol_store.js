/* global
   dcodeIO, Backbone, _, libsignal, textsecure, ConversationController, stringObject */

/* eslint-disable no-proto */

// eslint-disable-next-line func-names
(function() {
  'use strict';

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

  const Unprocessed = Backbone.Model.extend();
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

  function SignalProtocolStore() {}

  SignalProtocolStore.prototype = {
    constructor: SignalProtocolStore,
    async getIdentityKeyPair() {
      const item = await window.Signal.Data.getItemById('identityKey');
      if (item) {
        return item.value;
      }

      return undefined;
    },
    async getLocalRegistrationId() {
      return 1;
      
      // const item = await window.Signal.Data.getItemById('registrationId');
      // if (item) {
      //   return item.value;
      // }

      // return undefined;
    },

    /* Returns a prekeypair object or undefined */
    async loadPreKey(keyId) {
      const key = await window.Signal.Data.getPreKeyById(keyId);
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
    async loadPreKeyForContactIdentityKeyString(contactIdentityKeyString) {
      const key = await window.Signal.Data.getPreKeyByRecipient(contactIdentityKeyString);

      if (key) {
        window.log.info('Successfully fetched prekey for recipient:', contactIdentityKeyString);
        return {
          pubKey: key.publicKey,
          privKey: key.privateKey,
          keyId: key.id,
          recipient: key.recipient,
        };
      }
    },
    async loadContactPreKey(pubKey) {
      const preKey = await window.Signal.Data.getContactPreKeyByIdentityKey(pubKey);
      if (preKey) {
        return {
          id: preKey.id,
          keyId: preKey.keyId,
          publicKey: preKey.publicKey,
          identityKeyString: preKey.identityKeyString,
        }
      }

      window.log.error('Failed to fetch contact prekey:', pubKey);
      return undefined;
    },
    async loadContactPreKeys(filters) {
      const { keyId, identityKeyString } = filters;
      const keys = await window.Signal.Data.getContactPreKeys(keyId, identityKeyString);
      if (keys) {
        return keys.map(preKey => ({
          id: preKey.id,
          keyId: preKey.keyId,
          publicKey: preKey.publicKey,
          identityKeyString: preKey.identityKeyString,
        }));
      }

      window.log.error(
        'Failed to fetch signed prekey with filters',
        filters
      );
      return undefined;
    },
    async storeContactPreKey(pubKey, preKey) {
      const key = {
        // id: (autoincrement)
        identityKeyString: pubKey,
        publicKey: preKey.publicKey,
        keyId: preKey.keyId,
      };

      await window.Signal.Data.createOrUpdateContactPreKey(key);
    },
    async storePreKey(keyId, keyPair, contactIdentityKeyString) {
      const data = {
        id: keyId,
        publicKey: keyPair.pubKey,
        privateKey: keyPair.privKey,
        recipient: contactIdentityKeyString,
      };

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

      await window.Signal.Data.removePreKeyById(keyId);
    },
    async clearPreKeyStore() {
      await window.Signal.Data.removeAllPreKeys();
    },

    /* Returns a signed keypair object or undefined */
    async loadSignedPreKey(keyId) {
      const key = await window.Signal.Data.getSignedPreKeyById(keyId);
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
    async loadContactSignedPreKeys(filters) {
      const { keyId, identityKeyString } = filters;
      const keys = await window.Signal.Data.getContactSignedPreKeys(keyId, identityKeyString);
      if (keys) {
        return keys.map(preKey => ({
          id: preKey.id,
          identityKeyString: preKey.identityKeyString,
          publicKey: preKey.publicKey,
          signature: preKey.signature,
          created_at: preKey.created_at,
          keyId: preKey.keyId,
          confirmed: preKey.confirmed,
        }));
      }

      window.log.error(
        'Failed to fetch contact signed prekey with filters',
        filters
      );
      return undefined;
    },
    async loadContactSignedPreKey(pubKey) {
      const preKey = await window.Signal.Data.getContactSignedPreKeyByIdentityKey(pubKey);
      if (preKey) {
        return {
          id: preKey.id,
          identityKeyString: preKey.identityKeyString,
          publicKey: preKey.publicKey,
          signature: preKey.signature,
          created_at: preKey.created_at,
          keyId: preKey.keyId,
          confirmed: preKey.confirmed,
        };
      }
      window.log.error('Failed to fetch contact signed prekey:', pubKey);
      return undefined;
    },
    async loadSignedPreKeys() {
      if (arguments.length > 0) {
        throw new Error('loadSignedPreKeys takes no arguments');
      }

      const keys = await window.Signal.Data.getAllSignedPreKeys();
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
      const key = {
        id: keyId,
        publicKey: keyPair.pubKey,
        privateKey: keyPair.privKey,
        created_at: Date.now(),
        confirmed: Boolean(confirmed),
        signature,
      };
      await window.Signal.Data.createOrUpdateSignedPreKey(key);
    },
    async storeContactSignedPreKey(pubKey, signedPreKey) {
      const key = {
        // id: (autoincrement)
        identityKeyString: pubKey,
        keyId: signedPreKey.keyId,
        publicKey: signedPreKey.publicKey,
        signature: signedPreKey.signature,
        created_at: Date.now(),
        confirmed: false,
      };
      await window.Signal.Data.createOrUpdateContactSignedPreKey(key);
    },
    async removeSignedPreKey(keyId) {
      await window.Signal.Data.removeSignedPreKeyById(keyId);
    },
    async clearSignedPreKeysStore() {
      await window.Signal.Data.removeAllSignedPreKeys();
    },

    async loadSession(encodedNumber) {
      if (encodedNumber === null || encodedNumber === undefined) {
        throw new Error('Tried to get session for undefined/null number');
      }

      const session = await window.Signal.Data.getSessionById(encodedNumber);
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

      await window.Signal.Data.createOrUpdateSession(data);
    },
    async getDeviceIds(number) {
      if (number === null || number === undefined) {
        throw new Error('Tried to get device ids for undefined/null number');
      }

      const sessions = await window.Signal.Data.getSessionsByNumber(number);
      return _.pluck(sessions, 'deviceId');
    },
    async removeSession(encodedNumber) {
      window.log.info('deleting session for ', encodedNumber);
      await window.Signal.Data.removeSessionById(encodedNumber);
    },
    async removeAllSessions(number) {
      if (number === null || number === undefined) {
        throw new Error('Tried to remove sessions for undefined/null number');
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
      window.Signal.Data.removeAllSessions();
    },
    async isTrustedIdentity(identifier, publicKey, direction) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to get identity key for undefined/null key');
      }
      const number = textsecure.utils.unencodeNumber(identifier)[0];
      const isOurNumber = number === textsecure.storage.user.getNumber();

      const identityRecord = await window.Signal.Data.getIdentityKeyById(
        number
      );

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
      const identityRecord = await window.Signal.Data.getIdentityKeyById(
        number
      );

      if (identityRecord) {
        return identityRecord.publicKey;
      }

      return undefined;
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
      const identityRecord = await window.Signal.Data.getIdentityKeyById(
        number
      );

      if (!identityRecord || !identityRecord.publicKey) {
        // Lookup failed, or the current key was removed, so save this one.
        window.log.info('Saving new identity...');
        await window.Signal.Data.createOrUpdateIdentityKey({
          id: number,
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

        await window.Signal.Data.createOrUpdateIdentityKey({
          id: number,
          publicKey,
          firstUse: false,
          timestamp: Date.now(),
          verified: verifiedStatus,
          nonblockingApproval,
        });

        try {
          this.trigger('keychange', number);
        } catch (error) {
          window.log.error(
            'saveIdentity error triggering keychange:',
            error && error.stack ? error.stack : error
          );
        }
        await this.archiveSiblingSessions(identifier);

        return true;
      } else if (this.isNonBlockingApprovalRequired(identityRecord)) {
        window.log.info('Setting approval status...');

        identityRecord.nonblockingApproval = nonblockingApproval;
        await window.Signal.Data.createOrUpdateIdentityKey(identityRecord);

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
    async saveIdentityWithAttributes(identifier, attributes) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to put identity key for undefined/null key');
      }

      const number = textsecure.utils.unencodeNumber(identifier)[0];
      const identityRecord = await window.Signal.Data.getIdentityKeyById(
        number
      );

      const updates = {
        id: number,
        ...identityRecord,
        ...attributes,
      };

      const model = new IdentityRecord(updates);
      if (model.isValid()) {
        await window.Signal.Data.createOrUpdateIdentityKey(updates);
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
      const identityRecord = await window.Signal.Data.getIdentityKeyById(
        number
      );

      if (!identityRecord) {
        throw new Error(`No identity record for ${number}`);
      }

      identityRecord.nonblockingApproval = nonblockingApproval;
      await window.Signal.Data.createOrUpdateIdentityKey(identityRecord);
    },
    async setVerified(number, verifiedStatus, publicKey) {
      if (number === null || number === undefined) {
        throw new Error('Tried to set verified for undefined/null key');
      }
      if (!validateVerifiedStatus(verifiedStatus)) {
        throw new Error('Invalid verified status');
      }
      if (arguments.length > 2 && !(publicKey instanceof ArrayBuffer)) {
        throw new Error('Invalid public key');
      }

      const identityRecord = await window.Signal.Data.getIdentityKeyById(
        number
      );
      if (!identityRecord) {
        throw new Error(`No identity record for ${number}`);
      }

      if (
        !publicKey ||
        equalArrayBuffers(identityRecord.publicKey, publicKey)
      ) {
        identityRecord.verified = verifiedStatus;

        const model = new IdentityRecord(identityRecord);
        if (model.isValid()) {
          await window.Signal.Data.createOrUpdateIdentityKey(identityRecord);
        } else {
          throw identityRecord.validationError;
        }
      } else {
        window.log.info('No identity record for specified publicKey');
      }
    },
    async getVerified(number) {
      if (number === null || number === undefined) {
        throw new Error('Tried to set verified for undefined/null key');
      }

      const identityRecord = await window.Signal.Data.getIdentityKeyById(
        number
      );

      if (!identityRecord) {
        throw new Error(`No identity record for ${number}`);
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
    async processUnverifiedMessage(number, verifiedStatus, publicKey) {
      if (number === null || number === undefined) {
        throw new Error('Tried to set verified for undefined/null key');
      }
      if (publicKey !== undefined && !(publicKey instanceof ArrayBuffer)) {
        throw new Error('Invalid public key');
      }

      const identityRecord = await window.Signal.Data.getIdentityKeyById(
        number
      );
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
          number,
          verifiedStatus,
          publicKey
        );
        return false;
      }

      if (!isPresent || !isEqual) {
        await textsecure.storage.protocol.saveIdentityWithAttributes(number, {
          publicKey,
          verified: verifiedStatus,
          firstUse: false,
          timestamp: Date.now(),
          nonblockingApproval: true,
        });

        if (isPresent && !isEqual) {
          try {
            this.trigger('keychange', number);
          } catch (error) {
            window.log.error(
              'processUnverifiedMessage error triggering keychange:',
              error && error.stack ? error.stack : error
            );
          }

          await this.archiveAllSessions(number);

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
    async processVerifiedMessage(number, verifiedStatus, publicKey) {
      if (number === null || number === undefined) {
        throw new Error('Tried to set verified for undefined/null key');
      }
      if (!validateVerifiedStatus(verifiedStatus)) {
        throw new Error('Invalid verified status');
      }
      if (publicKey !== undefined && !(publicKey instanceof ArrayBuffer)) {
        throw new Error('Invalid public key');
      }

      const identityRecord = await window.Signal.Data.getIdentityKeyById(
        number
      );

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
          number,
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
        await textsecure.storage.protocol.saveIdentityWithAttributes(number, {
          publicKey,
          verified: verifiedStatus,
          firstUse: false,
          timestamp: Date.now(),
          nonblockingApproval: true,
        });

        if (isPresent && !isEqual) {
          try {
            this.trigger('keychange', number);
          } catch (error) {
            window.log.error(
              'processVerifiedMessage error triggering keychange:',
              error && error.stack ? error.stack : error
            );
          }

          await this.archiveAllSessions(number);

          // true signifies that we overwrote a previous key with a new one
          return true;
        }
      }

      // We get here if we got a new key and the status is DEFAULT. If the
      //   message is out of date, we don't want to lose whatever more-secure
      //   state we had before.
      return false;
    },
    async isUntrusted(number) {
      if (number === null || number === undefined) {
        throw new Error('Tried to set verified for undefined/null key');
      }

      const identityRecord = await window.Signal.Data.getIdentityKeyById(
        number
      );

      if (!identityRecord) {
        throw new Error(`No identity record for ${number}`);
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
    async removeIdentityKey(number) {
      await window.Signal.Data.removeIdentityKeyById(number);
      return textsecure.storage.protocol.removeAllSessions(number);
    },

    // Groups
    async getGroup(groupId) {
      if (groupId === null || groupId === undefined) {
        throw new Error('Tried to get group for undefined/null id');
      }

      const group = await window.Signal.Data.getGroupById(groupId);
      if (group) {
        return group.data;
      }

      return undefined;
    },
    async putGroup(groupId, group) {
      if (groupId === null || groupId === undefined) {
        throw new Error('Tried to put group key for undefined/null id');
      }
      if (group === null || group === undefined) {
        throw new Error('Tried to put undefined/null group object');
      }
      const data = {
        id: groupId,
        data: group,
      };
      await window.Signal.Data.createOrUpdateGroup(data);
    },
    async removeGroup(groupId) {
      if (groupId === null || groupId === undefined) {
        throw new Error('Tried to remove group key for undefined/null id');
      }

      await window.Signal.Data.removeGroupById(groupId);
    },

    // Not yet processed messages - for resiliency
    getUnprocessedCount() {
      return window.Signal.Data.getUnprocessedCount();
    },
    getAllUnprocessed() {
      return window.Signal.Data.getAllUnprocessed();
    },
    getUnprocessedById(id) {
      return window.Signal.Data.getUnprocessedById(id, { Unprocessed });
    },
    addUnprocessed(data) {
      // We need to pass forceSave because the data has an id already, which will cause
      //   an update instead of an insert.
      return window.Signal.Data.saveUnprocessed(data, {
        forceSave: true,
        Unprocessed,
      });
    },
    saveUnprocessed(data) {
      return window.Signal.Data.saveUnprocessed(data, { Unprocessed });
    },
    removeUnprocessed(id) {
      return window.Signal.Data.removeUnprocessed(id, { Unprocessed });
    },
    removeAllUnprocessed() {
      return window.Signal.Data.removeAllUnprocessed();
    },
    async removeAllData() {
      await window.Signal.Data.removeAll();

      window.storage.reset();
      await window.storage.fetch();

      ConversationController.reset();
      await ConversationController.load();
    },
    async removeAllConfiguration() {
      await window.Signal.Data.removeAllConfiguration();

      window.storage.reset();
      await window.storage.fetch();
    },
  };
  _.extend(SignalProtocolStore.prototype, Backbone.Events);

  window.SignalProtocolStore = SignalProtocolStore;
  window.SignalProtocolStore.prototype.Direction = Direction;
  window.SignalProtocolStore.prototype.VerifiedStatus = VerifiedStatus;
})();
