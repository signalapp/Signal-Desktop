// Copyright 2016-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable class-methods-use-this */

import { fromEncodedBinaryToArrayBuffer, constantTimeEqual } from './Crypto';
import { isNotNil } from './util/isNotNil';
import { isMoreRecentThan } from './util/timestamp';

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

function validateVerifiedStatus(status: number): boolean {
  if (
    status === VerifiedStatus.DEFAULT ||
    status === VerifiedStatus.VERIFIED ||
    status === VerifiedStatus.UNVERIFIED
  ) {
    return true;
  }
  return false;
}

const IdentityRecord = window.Backbone.Model.extend({
  storeName: 'identityKeys',
  validAttributes: [
    'id',
    'publicKey',
    'firstUse',
    'timestamp',
    'verified',
    'nonblockingApproval',
  ],
  validate(attrs: IdentityKeyType) {
    const attributeNames = window._.keys(attrs);
    const { validAttributes } = this;
    const allValid = window._.all(attributeNames, attributeName =>
      window._.contains(validAttributes, attributeName)
    );
    if (!allValid) {
      return new Error('Invalid identity key attribute names');
    }
    const allPresent = window._.all(validAttributes, attributeName =>
      window._.contains(attributeNames, attributeName)
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

async function normalizeEncodedAddress(
  encodedAddress: string
): Promise<string> {
  const [identifier, deviceId] = window.textsecure.utils.unencodeNumber(
    encodedAddress
  );
  try {
    const conv = window.ConversationController.getOrCreate(
      identifier,
      'private'
    );
    return `${conv.get('id')}.${deviceId}`;
  } catch (e) {
    window.log.error(`could not get conversation for identifier ${identifier}`);
    throw e;
  }
}

type HasIdType = {
  id: string | number;
};

async function _hydrateCache<T extends HasIdType>(
  object: SignalProtocolStore,
  field: keyof SignalProtocolStore,
  itemsPromise: Promise<Array<T>>
): Promise<void> {
  const items = await itemsPromise;

  const cache: Record<string, T> = Object.create(null);
  for (let i = 0, max = items.length; i < max; i += 1) {
    const item = items[i];
    const { id } = item;

    cache[id] = item;
  }

  window.log.info(`SignalProtocolStore: Finished caching ${field} data`);
  // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-explicit-any
  object[field] = cache as any;
}

type KeyPairType = {
  privKey: ArrayBuffer;
  pubKey: ArrayBuffer;
};

type IdentityKeyType = {
  firstUse: boolean;
  id: string;
  nonblockingApproval: boolean;
  publicKey: ArrayBuffer;
  timestamp: number;
  verified: number;
};

type SessionType = {
  conversationId: string;
  deviceId: number;
  id: string;
  record: string;
};

type SignedPreKeyType = {
  confirmed: boolean;
  // eslint-disable-next-line camelcase
  created_at: number;
  id: number;
  privateKey: ArrayBuffer;
  publicKey: ArrayBuffer;
};
type OuterSignedPrekeyType = {
  confirmed: boolean;
  // eslint-disable-next-line camelcase
  created_at: number;
  keyId: number;
  privKey: ArrayBuffer;
  pubKey: ArrayBuffer;
};
type PreKeyType = {
  id: number;
  privateKey: ArrayBuffer;
  publicKey: ArrayBuffer;
};

type UnprocessedType = {
  id: string;
  timestamp: number;
  version: number;
  attempts: number;
  envelope: string;
  decrypted?: string;
  source?: string;
  sourceDevice: string;
  serverTimestamp: number;
};

// We add a this parameter to avoid an 'implicit any' error on the next line
const EventsMixin = (function EventsMixin(this: unknown) {
  window._.assign(this, window.Backbone.Events);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any) as typeof window.Backbone.EventsMixin;

export class SignalProtocolStore extends EventsMixin {
  // Enums used across the app

  Direction = Direction;

  VerifiedStatus = VerifiedStatus;

  // Cached values

  ourIdentityKey?: KeyPairType;

  ourRegistrationId?: number;

  identityKeys?: Record<string, IdentityKeyType>;

  sessions?: Record<string, SessionType>;

  signedPreKeys?: Record<string, SignedPreKeyType>;

  preKeys?: Record<string, PreKeyType>;

  async hydrateCaches(): Promise<void> {
    await Promise.all([
      (async () => {
        const item = await window.Signal.Data.getItemById('identityKey');
        this.ourIdentityKey = item ? item.value : undefined;
      })(),
      (async () => {
        const item = await window.Signal.Data.getItemById('registrationId');
        this.ourRegistrationId = item ? item.value : undefined;
      })(),
      _hydrateCache<IdentityKeyType>(
        this,
        'identityKeys',
        window.Signal.Data.getAllIdentityKeys()
      ),
      _hydrateCache<SessionType>(
        this,
        'sessions',
        window.Signal.Data.getAllSessions()
      ),
      _hydrateCache<PreKeyType>(
        this,
        'preKeys',
        window.Signal.Data.getAllPreKeys()
      ),
      _hydrateCache<SignedPreKeyType>(
        this,
        'signedPreKeys',
        window.Signal.Data.getAllSignedPreKeys()
      ),
    ]);
  }

  async getIdentityKeyPair(): Promise<KeyPairType | undefined> {
    return this.ourIdentityKey;
  }

  async getLocalRegistrationId(): Promise<number | undefined> {
    return this.ourRegistrationId;
  }

  // PreKeys

  async loadPreKey(keyId: string | number): Promise<KeyPairType | undefined> {
    if (!this.preKeys) {
      throw new Error('loadPreKey: this.preKeys not yet cached!');
    }

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
  }

  async storePreKey(keyId: number, keyPair: KeyPairType): Promise<void> {
    if (!this.preKeys) {
      throw new Error('storePreKey: this.preKeys not yet cached!');
    }

    const data = {
      id: keyId,
      publicKey: keyPair.pubKey,
      privateKey: keyPair.privKey,
    };

    this.preKeys[keyId] = data;
    await window.Signal.Data.createOrUpdatePreKey(data);
  }

  async removePreKey(keyId: number): Promise<void> {
    if (!this.preKeys) {
      throw new Error('removePreKey: this.preKeys not yet cached!');
    }

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
  }

  async clearPreKeyStore(): Promise<void> {
    this.preKeys = Object.create(null);
    await window.Signal.Data.removeAllPreKeys();
  }

  // Signed PreKeys

  async loadSignedPreKey(
    keyId: number
  ): Promise<OuterSignedPrekeyType | undefined> {
    if (!this.signedPreKeys) {
      throw new Error('loadSignedPreKey: this.signedPreKeys not yet cached!');
    }

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
  }

  async loadSignedPreKeys(): Promise<Array<OuterSignedPrekeyType>> {
    if (!this.signedPreKeys) {
      throw new Error('loadSignedPreKeys: this.signedPreKeys not yet cached!');
    }

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
  }

  async storeSignedPreKey(
    keyId: number,
    keyPair: KeyPairType,
    confirmed?: boolean
  ): Promise<void> {
    if (!this.signedPreKeys) {
      throw new Error('storeSignedPreKey: this.signedPreKeys not yet cached!');
    }

    const data = {
      id: keyId,
      publicKey: keyPair.pubKey,
      privateKey: keyPair.privKey,
      created_at: Date.now(),
      confirmed: Boolean(confirmed),
    };

    this.signedPreKeys[keyId] = data;
    await window.Signal.Data.createOrUpdateSignedPreKey(data);
  }

  async removeSignedPreKey(keyId: number): Promise<void> {
    if (!this.signedPreKeys) {
      throw new Error('removeSignedPreKey: this.signedPreKeys not yet cached!');
    }

    delete this.signedPreKeys[keyId];
    await window.Signal.Data.removeSignedPreKeyById(keyId);
  }

  async clearSignedPreKeysStore(): Promise<void> {
    this.signedPreKeys = Object.create(null);
    await window.Signal.Data.removeAllSignedPreKeys();
  }

  // Sessions

  async loadSession(encodedAddress: string): Promise<string | undefined> {
    if (!this.sessions) {
      throw new Error('loadSession: this.sessions not yet cached!');
    }

    if (encodedAddress === null || encodedAddress === undefined) {
      throw new Error('Tried to get session for undefined/null number');
    }

    try {
      const id = await normalizeEncodedAddress(encodedAddress);
      const session = this.sessions[id];

      if (session) {
        return session.record;
      }
    } catch (error) {
      const errorString = error && error.stack ? error.stack : error;
      window.log.error(
        `could not load session ${encodedAddress}: ${errorString}`
      );
    }

    return undefined;
  }

  async storeSession(encodedAddress: string, record: string): Promise<void> {
    if (!this.sessions) {
      throw new Error('storeSession: this.sessions not yet cached!');
    }

    if (encodedAddress === null || encodedAddress === undefined) {
      throw new Error('Tried to put session for undefined/null number');
    }
    const unencoded = window.textsecure.utils.unencodeNumber(encodedAddress);
    const deviceId = parseInt(unencoded[1], 10);

    try {
      const id = await normalizeEncodedAddress(encodedAddress);
      const previousData = this.sessions[id];

      const data = {
        id,
        conversationId: window.textsecure.utils.unencodeNumber(id)[0],
        deviceId,
        record,
      };

      // Optimistically update in-memory cache; will revert if save fails.
      this.sessions[id] = data;

      try {
        await window.Signal.Data.createOrUpdateSession(data);
      } catch (e) {
        if (previousData) {
          this.sessions[id] = previousData;
        }
        throw e;
      }
    } catch (error) {
      const errorString = error && error.stack ? error.stack : error;
      window.log.error(
        `could not store session for ${encodedAddress}: ${errorString}`
      );
    }
  }

  async getDeviceIds(identifier: string): Promise<Array<number>> {
    if (!this.sessions) {
      throw new Error('getDeviceIds: this.sessions not yet cached!');
    }
    if (identifier === null || identifier === undefined) {
      throw new Error('Tried to get device ids for undefined/null number');
    }

    try {
      const id = window.ConversationController.getConversationId(identifier);
      const allSessions = Object.values(this.sessions);
      const sessions = allSessions.filter(
        session => session.conversationId === id
      );
      const openSessions = await Promise.all(
        sessions.map(async session => {
          const sessionCipher = new window.libsignal.SessionCipher(
            window.textsecure.storage.protocol,
            session.id
          );

          const hasOpenSession = await sessionCipher.hasOpenSession();
          if (hasOpenSession) {
            return session;
          }

          return undefined;
        })
      );

      return openSessions.filter(isNotNil).map(item => item.deviceId);
    } catch (error) {
      window.log.error(
        `could not get device ids for identifier ${identifier}`,
        error && error.stack ? error.stack : error
      );
    }

    return [];
  }

  async removeSession(encodedAddress: string): Promise<void> {
    if (!this.sessions) {
      throw new Error('removeSession: this.sessions not yet cached!');
    }

    window.log.info('removeSession: deleting session for', encodedAddress);
    try {
      const id = await normalizeEncodedAddress(encodedAddress);
      delete this.sessions[id];
      await window.Signal.Data.removeSessionById(id);
    } catch (e) {
      window.log.error(`could not delete session for ${encodedAddress}`);
    }
  }

  async removeAllSessions(identifier: string): Promise<void> {
    if (!this.sessions) {
      throw new Error('removeAllSessions: this.sessions not yet cached!');
    }

    if (identifier === null || identifier === undefined) {
      throw new Error('Tried to remove sessions for undefined/null number');
    }

    window.log.info('removeAllSessions: deleting sessions for', identifier);

    const id = window.ConversationController.getConversationId(identifier);

    const allSessions = Object.values(this.sessions);

    for (let i = 0, max = allSessions.length; i < max; i += 1) {
      const session = allSessions[i];
      if (session.conversationId === id) {
        delete this.sessions[session.id];
      }
    }

    await window.Signal.Data.removeSessionsByConversation(identifier);
  }

  async archiveSiblingSessions(identifier: string): Promise<void> {
    if (!this.sessions) {
      throw new Error('archiveSiblingSessions: this.sessions not yet cached!');
    }

    window.log.info(
      'archiveSiblingSessions: archiving sibling sessions for',
      identifier
    );

    const address = window.libsignal.SignalProtocolAddress.fromString(
      identifier
    );

    const deviceIds = await this.getDeviceIds(address.getName());
    const siblings = window._.without(deviceIds, address.getDeviceId());

    await Promise.all(
      siblings.map(async deviceId => {
        const sibling = new window.libsignal.SignalProtocolAddress(
          address.getName(),
          deviceId
        );
        window.log.info(
          'archiveSiblingSessions: closing session for',
          sibling.toString()
        );
        const sessionCipher = new window.libsignal.SessionCipher(
          window.textsecure.storage.protocol,
          sibling
        );
        await sessionCipher.closeOpenSessionForDevice();
      })
    );
  }

  async archiveAllSessions(identifier: string): Promise<void> {
    if (!this.sessions) {
      throw new Error('archiveAllSessions: this.sessions not yet cached!');
    }

    window.log.info(
      'archiveAllSessions: archiving all sessions for',
      identifier
    );

    const deviceIds = await this.getDeviceIds(identifier);

    await Promise.all(
      deviceIds.map(async deviceId => {
        const address = new window.libsignal.SignalProtocolAddress(
          identifier,
          deviceId
        );
        window.log.info(
          'archiveAllSessions: closing session for',
          address.toString()
        );
        const sessionCipher = new window.libsignal.SessionCipher(
          window.textsecure.storage.protocol,
          address
        );
        await sessionCipher.closeOpenSessionForDevice();
      })
    );
  }

  async clearSessionStore(): Promise<void> {
    this.sessions = Object.create(null);
    window.Signal.Data.removeAllSessions();
  }

  // Identity Keys

  getIdentityRecord(identifier: string): IdentityKeyType | undefined {
    if (!this.identityKeys) {
      throw new Error('getIdentityRecord: this.identityKeys not yet cached!');
    }

    try {
      const id = window.ConversationController.getConversationId(identifier);
      if (!id) {
        throw new Error(
          `getIdentityRecord: No conversation id for identifier ${identifier}`
        );
      }

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
  }

  async isTrustedIdentity(
    encodedAddress: string,
    publicKey: ArrayBuffer,
    direction: number
  ): Promise<boolean> {
    if (!this.identityKeys) {
      throw new Error('getIdentityRecord: this.identityKeys not yet cached!');
    }

    if (encodedAddress === null || encodedAddress === undefined) {
      throw new Error('Tried to get identity key for undefined/null key');
    }
    const identifier = window.textsecure.utils.unencodeNumber(
      encodedAddress
    )[0];
    const ourNumber = window.textsecure.storage.user.getNumber();
    const ourUuid = window.textsecure.storage.user.getUuid();
    const isOurIdentifier =
      (ourNumber && identifier === ourNumber) ||
      (ourUuid && identifier === ourUuid);

    const identityRecord = this.getIdentityRecord(identifier);

    if (isOurIdentifier) {
      if (identityRecord && identityRecord.publicKey) {
        return constantTimeEqual(identityRecord.publicKey, publicKey);
      }
      window.log.warn(
        'isTrustedIdentity: No local record for our own identifier. Returning true.'
      );
      return true;
    }

    switch (direction) {
      case Direction.SENDING:
        return this.isTrustedForSending(publicKey, identityRecord);
      case Direction.RECEIVING:
        return true;
      default:
        throw new Error(`Unknown direction: ${direction}`);
    }
  }

  isTrustedForSending(
    publicKey: ArrayBuffer,
    identityRecord?: IdentityKeyType
  ): boolean {
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
    if (!constantTimeEqual(existing, publicKey)) {
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
  }

  async loadIdentityKey(identifier: string): Promise<ArrayBuffer | undefined> {
    if (identifier === null || identifier === undefined) {
      throw new Error('Tried to get identity key for undefined/null key');
    }
    const id = window.textsecure.utils.unencodeNumber(identifier)[0];
    const identityRecord = this.getIdentityRecord(id);

    if (identityRecord) {
      return identityRecord.publicKey;
    }

    return undefined;
  }

  private async _saveIdentityKey(data: IdentityKeyType): Promise<void> {
    if (!this.identityKeys) {
      throw new Error('_saveIdentityKey: this.identityKeys not yet cached!');
    }

    const { id } = data;

    const previousData = this.identityKeys[id];

    // Optimistically update in-memory cache; will revert if save fails.
    this.identityKeys[id] = data;

    try {
      await window.Signal.Data.createOrUpdateIdentityKey(data);
    } catch (error) {
      if (previousData) {
        this.identityKeys[id] = previousData;
      }

      throw error;
    }
  }

  async saveIdentity(
    encodedAddress: string,
    publicKey: ArrayBuffer,
    nonblockingApproval: boolean
  ): Promise<boolean> {
    if (!this.identityKeys) {
      throw new Error('saveIdentity: this.identityKeys not yet cached!');
    }

    if (encodedAddress === null || encodedAddress === undefined) {
      throw new Error('Tried to put identity key for undefined/null key');
    }
    if (!(publicKey instanceof ArrayBuffer)) {
      // eslint-disable-next-line no-param-reassign
      publicKey = fromEncodedBinaryToArrayBuffer(publicKey);
    }
    if (typeof nonblockingApproval !== 'boolean') {
      // eslint-disable-next-line no-param-reassign
      nonblockingApproval = false;
    }

    const identifier = window.textsecure.utils.unencodeNumber(
      encodedAddress
    )[0];
    const identityRecord = this.getIdentityRecord(identifier);
    const id = window.ConversationController.getOrCreate(
      identifier,
      'private'
    ).get('id');

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
    if (!constantTimeEqual(oldpublicKey, publicKey)) {
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
  }

  isNonBlockingApprovalRequired(identityRecord: IdentityKeyType): boolean {
    return (
      !identityRecord.firstUse &&
      isMoreRecentThan(identityRecord.timestamp, TIMESTAMP_THRESHOLD) &&
      !identityRecord.nonblockingApproval
    );
  }

  async saveIdentityWithAttributes(
    encodedAddress: string,
    attributes: IdentityKeyType
  ): Promise<void> {
    if (encodedAddress === null || encodedAddress === undefined) {
      throw new Error('Tried to put identity key for undefined/null key');
    }

    const identifier = window.textsecure.utils.unencodeNumber(
      encodedAddress
    )[0];
    const identityRecord = this.getIdentityRecord(identifier);
    const conv = window.ConversationController.getOrCreate(
      identifier,
      'private'
    );
    const id = conv.get('id');

    const updates = {
      ...identityRecord,
      ...attributes,
      id,
    };

    const model = new IdentityRecord(updates);
    if (model.isValid()) {
      await this._saveIdentityKey(updates);
    } else {
      throw model.validationError;
    }
  }

  async setApproval(
    encodedAddress: string,
    nonblockingApproval: boolean
  ): Promise<void> {
    if (encodedAddress === null || encodedAddress === undefined) {
      throw new Error('Tried to set approval for undefined/null identifier');
    }
    if (typeof nonblockingApproval !== 'boolean') {
      throw new Error('Invalid approval status');
    }

    const identifier = window.textsecure.utils.unencodeNumber(
      encodedAddress
    )[0];
    const identityRecord = this.getIdentityRecord(identifier);

    if (!identityRecord) {
      throw new Error(`No identity record for ${identifier}`);
    }

    identityRecord.nonblockingApproval = nonblockingApproval;
    await this._saveIdentityKey(identityRecord);
  }

  async setVerified(
    encodedAddress: string,
    verifiedStatus: number,
    publicKey: ArrayBuffer
  ): Promise<void> {
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

    if (!publicKey || constantTimeEqual(identityRecord.publicKey, publicKey)) {
      identityRecord.verified = verifiedStatus;

      const model = new IdentityRecord(identityRecord);
      if (model.isValid()) {
        await this._saveIdentityKey(identityRecord);
      } else if (model.validationError) {
        throw model.validationError;
      } else {
        throw new Error('setVerified: identity record data was invalid');
      }
    } else {
      window.log.info('No identity record for specified publicKey');
    }
  }

  async getVerified(identifier: string): Promise<number> {
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
  }

  // Resolves to true if a new identity key was saved
  processContactSyncVerificationState(
    identifier: string,
    verifiedStatus: number,
    publicKey: ArrayBuffer
  ): Promise<boolean> {
    if (verifiedStatus === VerifiedStatus.UNVERIFIED) {
      return this.processUnverifiedMessage(
        identifier,
        verifiedStatus,
        publicKey
      );
    }
    return this.processVerifiedMessage(identifier, verifiedStatus, publicKey);
  }

  // This function encapsulates the non-Java behavior, since the mobile apps don't
  //   currently receive contact syncs and therefore will see a verify sync with
  //   UNVERIFIED status
  async processUnverifiedMessage(
    identifier: string,
    verifiedStatus: number,
    publicKey?: ArrayBuffer
  ): Promise<boolean> {
    if (identifier === null || identifier === undefined) {
      throw new Error('Tried to set verified for undefined/null key');
    }
    if (publicKey !== undefined && !(publicKey instanceof ArrayBuffer)) {
      throw new Error('Invalid public key');
    }

    const identityRecord = this.getIdentityRecord(identifier);

    let isEqual = false;

    if (identityRecord && publicKey) {
      isEqual = constantTimeEqual(publicKey, identityRecord.publicKey);
    }

    if (
      identityRecord &&
      isEqual &&
      identityRecord.verified !== VerifiedStatus.UNVERIFIED
    ) {
      await window.textsecure.storage.protocol.setVerified(
        identifier,
        verifiedStatus,
        publicKey
      );
      return false;
    }

    if (publicKey && (!identityRecord || !isEqual)) {
      await window.textsecure.storage.protocol.saveIdentityWithAttributes(
        identifier,
        {
          publicKey,
          verified: verifiedStatus,
          firstUse: false,
          timestamp: Date.now(),
          nonblockingApproval: true,
        }
      );

      if (identityRecord && !isEqual) {
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
    //   4. no publicKey was passed into this function
    return false;
  }

  // This matches the Java method as of
  //   https://github.com/signalapp/Signal-Android/blob/d0bb68e1378f689e4d10ac6a46014164992ca4e4/src/org/thoughtcrime/securesms/util/IdentityUtil.java#L188
  async processVerifiedMessage(
    identifier: string,
    verifiedStatus: number,
    publicKey: ArrayBuffer
  ): Promise<boolean> {
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

    let isEqual = false;

    if (identityRecord && publicKey) {
      isEqual = constantTimeEqual(publicKey, identityRecord.publicKey);
    }

    if (!identityRecord && verifiedStatus === VerifiedStatus.DEFAULT) {
      window.log.info('No existing record for default status');
      return false;
    }

    if (
      identityRecord &&
      isEqual &&
      identityRecord.verified !== VerifiedStatus.DEFAULT &&
      verifiedStatus === VerifiedStatus.DEFAULT
    ) {
      await window.textsecure.storage.protocol.setVerified(
        identifier,
        verifiedStatus,
        publicKey
      );
      return false;
    }

    if (
      verifiedStatus === VerifiedStatus.VERIFIED &&
      (!identityRecord ||
        (identityRecord && !isEqual) ||
        (identityRecord && identityRecord.verified !== VerifiedStatus.VERIFIED))
    ) {
      await window.textsecure.storage.protocol.saveIdentityWithAttributes(
        identifier,
        {
          publicKey,
          verified: verifiedStatus,
          firstUse: false,
          timestamp: Date.now(),
          nonblockingApproval: true,
        }
      );

      if (identityRecord && !isEqual) {
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
  }

  isUntrusted(identifier: string): boolean {
    if (identifier === null || identifier === undefined) {
      throw new Error('Tried to set verified for undefined/null key');
    }

    const identityRecord = this.getIdentityRecord(identifier);
    if (!identityRecord) {
      throw new Error(`No identity record for ${identifier}`);
    }

    if (
      isMoreRecentThan(identityRecord.timestamp, TIMESTAMP_THRESHOLD) &&
      !identityRecord.nonblockingApproval &&
      !identityRecord.firstUse
    ) {
      return true;
    }

    return false;
  }

  async removeIdentityKey(identifier: string): Promise<void> {
    if (!this.identityKeys) {
      throw new Error('removeIdentityKey: this.identityKeys not yet cached!');
    }

    const id = window.ConversationController.getConversationId(identifier);
    if (id) {
      delete this.identityKeys[id];
      await window.Signal.Data.removeIdentityKeyById(id);
      await window.textsecure.storage.protocol.removeAllSessions(id);
    }
  }

  // Not yet processed messages - for resiliency
  getUnprocessedCount(): Promise<number> {
    return window.Signal.Data.getUnprocessedCount();
  }

  getAllUnprocessed(): Promise<Array<UnprocessedType>> {
    return window.Signal.Data.getAllUnprocessed();
  }

  getUnprocessedById(id: string): Promise<UnprocessedType | undefined> {
    return window.Signal.Data.getUnprocessedById(id);
  }

  addUnprocessed(data: UnprocessedType): Promise<number> {
    // We need to pass forceSave because the data has an id already, which will cause
    //   an update instead of an insert.
    return window.Signal.Data.saveUnprocessed(data, {
      forceSave: true,
    });
  }

  addMultipleUnprocessed(array: Array<UnprocessedType>): Promise<void> {
    // We need to pass forceSave because the data has an id already, which will cause
    //   an update instead of an insert.
    return window.Signal.Data.saveUnprocesseds(array, {
      forceSave: true,
    });
  }

  updateUnprocessedAttempts(id: string, attempts: number): Promise<void> {
    return window.Signal.Data.updateUnprocessedAttempts(id, attempts);
  }

  updateUnprocessedWithData(id: string, data: UnprocessedType): Promise<void> {
    return window.Signal.Data.updateUnprocessedWithData(id, data);
  }

  updateUnprocessedsWithData(items: Array<UnprocessedType>): Promise<void> {
    return window.Signal.Data.updateUnprocessedsWithData(items);
  }

  removeUnprocessed(idOrArray: string | Array<string>): Promise<void> {
    return window.Signal.Data.removeUnprocessed(idOrArray);
  }

  removeAllUnprocessed(): Promise<void> {
    return window.Signal.Data.removeAllUnprocessed();
  }

  async removeAllData(): Promise<void> {
    await window.Signal.Data.removeAll();
    await this.hydrateCaches();

    window.storage.reset();
    await window.storage.fetch();

    window.ConversationController.reset();
    await window.ConversationController.load();
  }

  async removeAllConfiguration(): Promise<void> {
    await window.Signal.Data.removeAllConfiguration();
    await this.hydrateCaches();

    window.storage.reset();
    await window.storage.fetch();
  }
}

window.SignalProtocolStore = SignalProtocolStore;
