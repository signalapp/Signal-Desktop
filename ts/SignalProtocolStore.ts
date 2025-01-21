// Copyright 2016 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import { omit } from 'lodash';
import { z } from 'zod';
import { EventEmitter } from 'events';

import {
  Direction,
  IdentityKeyPair,
  KyberPreKeyRecord,
  PreKeyRecord,
  PrivateKey,
  PublicKey,
  SenderKeyRecord,
  SessionRecord,
  SignedPreKeyRecord,
} from '@signalapp/libsignal-client';

import { DataReader, DataWriter } from './sql/Client';
import type { ItemType } from './sql/Interface';
import * as Bytes from './Bytes';
import { constantTimeEqual, sha256 } from './Crypto';
import { assertDev, strictAssert } from './util/assert';
import { isNotNil } from './util/isNotNil';
import { drop } from './util/drop';
import { Zone } from './util/Zone';
import { isMoreRecentThan } from './util/timestamp';
import type {
  DeviceType,
  IdentityKeyType,
  IdentityKeyIdType,
  KeyPairType,
  KyberPreKeyType,
  OuterSignedPrekeyType,
  PniKeyMaterialType,
  PniSignatureMessageType,
  PreKeyIdType,
  PreKeyType,
  SenderKeyIdType,
  SenderKeyType,
  SessionIdType,
  SessionResetsType,
  SessionType,
  SignedPreKeyIdType,
  SignedPreKeyType,
  UnprocessedType,
  CompatPreKeyType,
} from './textsecure/Types.d';
import type { ServiceIdString, PniString, AciString } from './types/ServiceId';
import { isServiceIdString, ServiceIdKind } from './types/ServiceId';
import type { Address } from './types/Address';
import type { QualifiedAddressStringType } from './types/QualifiedAddress';
import { QualifiedAddress } from './types/QualifiedAddress';
import * as log from './logging/log';
import * as Errors from './types/errors';
import { MINUTE } from './util/durations';
import { conversationJobQueue } from './jobs/conversationJobQueue';
import {
  KYBER_KEY_ID_KEY,
  SIGNED_PRE_KEY_ID_KEY,
} from './textsecure/AccountManager';
import { formatGroups, groupWhile } from './util/groupWhile';
import { parseUnknown } from './util/schemas';

const TIMESTAMP_THRESHOLD = 5 * 1000; // 5 seconds
const LOW_KEYS_THRESHOLD = 25;

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

const identityKeySchema = z.object({
  id: z.string(),
  publicKey: z.instanceof(Uint8Array),
  firstUse: z.boolean(),
  timestamp: z.number().refine((value: number) => value % 1 === 0 && value > 0),
  verified: z.number().refine(validateVerifiedStatus),
  nonblockingApproval: z.boolean(),
});

function validateIdentityKey(attrs: unknown): attrs is IdentityKeyType {
  // We'll throw if this doesn't match
  parseUnknown(identityKeySchema, attrs);
  return true;
}
/*
 * Potentially hundreds of items, so we'll group together sequences,
 * take the first 10 of the sequences, format them as ranges,
 * and log that once.
 * => '1-10, 12, 14-20'
 */
function formatKeys(keys: Array<number>): string {
  return formatGroups(
    groupWhile(keys.sort(), (a, b) => a + 1 === b).slice(0, 10),
    '-',
    ', ',
    String
  );
}

type HasIdType<T> = {
  id: T;
};
type CacheEntryType<DBType, HydratedType> =
  | {
      hydrated: false;
      fromDB: DBType;
    }
  | { hydrated: true; fromDB: DBType; item: HydratedType };

type MapFields =
  | 'kyberPreKeys'
  | 'identityKeys'
  | 'preKeys'
  | 'senderKeys'
  | 'sessions'
  | 'signedPreKeys';

export type SessionTransactionOptions = Readonly<{
  zone?: Zone;
}>;

export type SaveIdentityOptions = Readonly<{
  zone?: Zone;
  noOverwrite?: boolean;
}>;

export type VerifyAlternateIdentityOptionsType = Readonly<{
  aci: AciString;
  pni: PniString;
  signature: Uint8Array;
}>;

export type SetVerifiedExtra = Readonly<{
  firstUse?: boolean;
  nonblockingApproval?: boolean;
}>;

export const GLOBAL_ZONE = new Zone('GLOBAL_ZONE');

async function _fillCaches<ID, T extends HasIdType<ID>, HydratedType>(
  object: SignalProtocolStore,
  field: MapFields,
  itemsPromise: Promise<Array<T>>
): Promise<void> {
  const items = await itemsPromise;

  const cache = new Map<ID, CacheEntryType<T, HydratedType>>();
  for (let i = 0, max = items.length; i < max; i += 1) {
    const fromDB = items[i];
    const { id } = fromDB;

    cache.set(id, {
      fromDB,
      hydrated: false,
    });
  }

  log.info(`SignalProtocolStore: Finished caching ${field} data`);
  // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-explicit-any
  object[field] = cache as any;
}

export function hydrateSession(session: SessionType): SessionRecord {
  return SessionRecord.deserialize(Buffer.from(session.record));
}
export function hydratePublicKey(identityKey: IdentityKeyType): PublicKey {
  return PublicKey.deserialize(Buffer.from(identityKey.publicKey));
}
export function hydratePreKey(preKey: PreKeyType): PreKeyRecord {
  const publicKey = PublicKey.deserialize(Buffer.from(preKey.publicKey));
  const privateKey = PrivateKey.deserialize(Buffer.from(preKey.privateKey));
  return PreKeyRecord.new(preKey.keyId, publicKey, privateKey);
}
export function hydrateSignedPreKey(
  signedPreKey: SignedPreKeyType
): SignedPreKeyRecord {
  const createdAt = signedPreKey.created_at;
  const pubKey = PublicKey.deserialize(Buffer.from(signedPreKey.publicKey));
  const privKey = PrivateKey.deserialize(Buffer.from(signedPreKey.privateKey));
  const signature = Buffer.from([]);

  return SignedPreKeyRecord.new(
    signedPreKey.keyId,
    createdAt,
    pubKey,
    privKey,
    signature
  );
}

export function freezePublicKey(publicKey: PublicKey): Uint8Array {
  return publicKey.serialize();
}
export function freezePreKey(preKey: PreKeyRecord): KeyPairType {
  const keyPair = {
    pubKey: preKey.publicKey().serialize(),
    privKey: preKey.privateKey().serialize(),
  };
  return keyPair;
}
export function freezeSignedPreKey(
  signedPreKey: SignedPreKeyRecord
): KeyPairType {
  const keyPair = {
    pubKey: signedPreKey.publicKey().serialize(),
    privKey: signedPreKey.privateKey().serialize(),
  };
  return keyPair;
}

type SessionCacheEntry = CacheEntryType<SessionType, SessionRecord>;
type SenderKeyCacheEntry = CacheEntryType<SenderKeyType, SenderKeyRecord>;

type ZoneQueueEntryType = Readonly<{
  zone: Zone;
  callback(): void;
}>;

export class SignalProtocolStore extends EventEmitter {
  // Enums used across the app

  VerifiedStatus = VerifiedStatus;

  // Cached values

  #ourIdentityKeys = new Map<ServiceIdString, KeyPairType>();

  #ourRegistrationIds = new Map<ServiceIdString, number>();
  #cachedPniSignatureMessage: PniSignatureMessageType | undefined;

  identityKeys?: Map<
    IdentityKeyIdType,
    CacheEntryType<IdentityKeyType, PublicKey>
  >;

  kyberPreKeys?: Map<
    PreKeyIdType,
    CacheEntryType<KyberPreKeyType, KyberPreKeyRecord>
  >;

  senderKeys?: Map<SenderKeyIdType, SenderKeyCacheEntry>;

  sessions?: Map<SessionIdType, SessionCacheEntry>;

  preKeys?: Map<PreKeyIdType, CacheEntryType<PreKeyType, PreKeyRecord>>;

  signedPreKeys?: Map<
    SignedPreKeyIdType,
    CacheEntryType<SignedPreKeyType, SignedPreKeyRecord>
  >;

  senderKeyQueues = new Map<QualifiedAddressStringType, PQueue>();

  sessionQueues = new Map<SessionIdType, PQueue>();

  sessionQueueJobCounter = 0;

  readonly #identityQueues = new Map<ServiceIdString, PQueue>();
  #currentZone?: Zone;
  #currentZoneDepth = 0;
  readonly #zoneQueue: Array<ZoneQueueEntryType> = [];
  #pendingSessions = new Map<SessionIdType, SessionCacheEntry>();
  #pendingSenderKeys = new Map<SenderKeyIdType, SenderKeyCacheEntry>();
  #pendingUnprocessed = new Map<string, UnprocessedType>();

  async hydrateCaches(): Promise<void> {
    await Promise.all([
      (async () => {
        this.#ourIdentityKeys.clear();
        const map = (await DataReader.getItemById(
          'identityKeyMap'
        )) as unknown as ItemType<'identityKeyMap'>;
        if (!map) {
          return;
        }

        for (const serviceId of Object.keys(map.value)) {
          strictAssert(
            isServiceIdString(serviceId),
            'Invalid identity key serviceId'
          );
          const { privKey, pubKey } = map.value[serviceId];
          this.#ourIdentityKeys.set(serviceId, {
            privKey,
            pubKey,
          });
        }
      })(),
      (async () => {
        this.#ourRegistrationIds.clear();
        const map = (await DataReader.getItemById(
          'registrationIdMap'
        )) as unknown as ItemType<'registrationIdMap'>;
        if (!map) {
          return;
        }

        for (const serviceId of Object.keys(map.value)) {
          strictAssert(
            isServiceIdString(serviceId),
            'Invalid registration id serviceId'
          );
          this.#ourRegistrationIds.set(serviceId, map.value[serviceId]);
        }
      })(),
      _fillCaches<string, IdentityKeyType, PublicKey>(
        this,
        'identityKeys',
        DataReader.getAllIdentityKeys()
      ),
      _fillCaches<string, KyberPreKeyType, KyberPreKeyRecord>(
        this,
        'kyberPreKeys',
        DataReader.getAllKyberPreKeys()
      ),
      _fillCaches<string, SessionType, SessionRecord>(
        this,
        'sessions',
        DataReader.getAllSessions()
      ),
      _fillCaches<string, PreKeyType, PreKeyRecord>(
        this,
        'preKeys',
        DataReader.getAllPreKeys()
      ),
      _fillCaches<string, SenderKeyType, SenderKeyRecord>(
        this,
        'senderKeys',
        DataReader.getAllSenderKeys()
      ),
      _fillCaches<string, SignedPreKeyType, SignedPreKeyRecord>(
        this,
        'signedPreKeys',
        DataReader.getAllSignedPreKeys()
      ),
    ]);
  }

  getIdentityKeyPair(ourServiceId: ServiceIdString): KeyPairType | undefined {
    return this.#ourIdentityKeys.get(ourServiceId);
  }

  async getLocalRegistrationId(
    ourServiceId: ServiceIdString
  ): Promise<number | undefined> {
    return this.#ourRegistrationIds.get(ourServiceId);
  }

  #_getKeyId(ourServiceId: ServiceIdString, keyId: number): PreKeyIdType {
    return `${ourServiceId}:${keyId}`;
  }

  // KyberPreKeys

  #_getKyberPreKeyEntry(
    id: PreKeyIdType,
    logContext: string
  ):
    | { hydrated: true; fromDB: KyberPreKeyType; item: KyberPreKeyRecord }
    | undefined {
    if (!this.kyberPreKeys) {
      throw new Error(`${logContext}: this.kyberPreKeys not yet cached!`);
    }

    const entry = this.kyberPreKeys.get(id);
    if (!entry) {
      log.error(`${logContext}: Failed to fetch kyber prekey: ${id}`);
      return undefined;
    }

    if (entry.hydrated) {
      log.info(
        `${logContext}: Successfully fetched kyber prekey (cache hit): ${id}`
      );
      return entry;
    }

    const item = KyberPreKeyRecord.deserialize(Buffer.from(entry.fromDB.data));
    const newEntry = {
      hydrated: true as const,
      fromDB: entry.fromDB,
      item,
    };
    this.kyberPreKeys.set(id, newEntry);

    log.info(
      `${logContext}: Successfully fetched kyberPreKey (cache miss): ${id}`
    );
    return newEntry;
  }

  async loadKyberPreKey(
    ourServiceId: ServiceIdString,
    keyId: number
  ): Promise<KyberPreKeyRecord | undefined> {
    const id: PreKeyIdType = this.#_getKeyId(ourServiceId, keyId);
    const entry = this.#_getKyberPreKeyEntry(id, 'loadKyberPreKey');

    return entry?.item;
  }

  loadKyberPreKeys(
    ourServiceId: ServiceIdString,
    { isLastResort }: { isLastResort: boolean }
  ): Array<KyberPreKeyType> {
    if (!this.kyberPreKeys) {
      throw new Error('loadKyberPreKeys: this.kyberPreKeys not yet cached!');
    }

    if (arguments.length > 2) {
      throw new Error('loadKyberPreKeys takes two arguments');
    }

    const entries = Array.from(this.kyberPreKeys.values());
    return entries
      .map(item => item.fromDB)
      .filter(
        item =>
          item.ourServiceId === ourServiceId &&
          item.isLastResort === isLastResort
      );
  }

  async confirmKyberPreKey(
    ourServiceId: ServiceIdString,
    keyId: number
  ): Promise<void> {
    const kyberPreKeyCache = this.kyberPreKeys;
    if (!kyberPreKeyCache) {
      throw new Error('storeKyberPreKey: this.kyberPreKeys not yet cached!');
    }

    const id: PreKeyIdType = this.#_getKeyId(ourServiceId, keyId);
    const item = kyberPreKeyCache.get(id);
    if (!item) {
      throw new Error(`confirmKyberPreKey: missing kyber prekey ${id}!`);
    }

    const confirmedItem = {
      ...item,
      fromDB: {
        ...item.fromDB,
        isConfirmed: true,
      },
    };

    await DataWriter.createOrUpdateKyberPreKey(confirmedItem.fromDB);
    kyberPreKeyCache.set(id, confirmedItem);
  }

  async storeKyberPreKeys(
    ourServiceId: ServiceIdString,
    keys: Array<Omit<KyberPreKeyType, 'id'>>
  ): Promise<void> {
    const kyberPreKeyCache = this.kyberPreKeys;
    if (!kyberPreKeyCache) {
      throw new Error('storeKyberPreKey: this.kyberPreKeys not yet cached!');
    }

    const toSave: Array<KyberPreKeyType> = [];

    keys.forEach(key => {
      const id: PreKeyIdType = this.#_getKeyId(ourServiceId, key.keyId);
      if (kyberPreKeyCache.has(id)) {
        throw new Error(`storeKyberPreKey: kyber prekey ${id} already exists!`);
      }

      const kyberPreKey = {
        id,

        createdAt: key.createdAt,
        data: key.data,
        isConfirmed: key.isConfirmed,
        isLastResort: key.isLastResort,
        keyId: key.keyId,
        ourServiceId,
      };

      toSave.push(kyberPreKey);
    });

    await DataWriter.bulkAddKyberPreKeys(toSave);
    toSave.forEach(kyberPreKey => {
      kyberPreKeyCache.set(kyberPreKey.id, {
        hydrated: false,
        fromDB: kyberPreKey,
      });
    });
  }

  async maybeRemoveKyberPreKey(
    ourServiceId: ServiceIdString,
    keyId: number
  ): Promise<void> {
    const id: PreKeyIdType = this.#_getKeyId(ourServiceId, keyId);
    const entry = this.#_getKyberPreKeyEntry(id, 'maybeRemoveKyberPreKey');

    if (!entry) {
      return;
    }
    if (entry.fromDB.isLastResort) {
      log.info(
        `maybeRemoveKyberPreKey: Not removing kyber prekey ${id}; it's a last resort key`
      );
      return;
    }

    await this.removeKyberPreKeys(ourServiceId, [keyId]);
  }

  async removeKyberPreKeys(
    ourServiceId: ServiceIdString,
    keyIds: Array<number>
  ): Promise<void> {
    const kyberPreKeyCache = this.kyberPreKeys;
    if (!kyberPreKeyCache) {
      throw new Error('removeKyberPreKeys: this.kyberPreKeys not yet cached!');
    }

    const ids = keyIds.map(keyId => this.#_getKeyId(ourServiceId, keyId));

    log.info('removeKyberPreKeys: Removing kyber prekeys:', formatKeys(keyIds));
    const changes = await DataWriter.removeKyberPreKeyById(ids);
    log.info(`removeKyberPreKeys: Removed ${changes} kyber prekeys`);
    ids.forEach(id => {
      kyberPreKeyCache.delete(id);
    });

    if (kyberPreKeyCache.size < LOW_KEYS_THRESHOLD) {
      this.#emitLowKeys(
        ourServiceId,
        `removeKyberPreKeys@${kyberPreKeyCache.size}`
      );
    }
  }

  async clearKyberPreKeyStore(): Promise<void> {
    if (this.kyberPreKeys) {
      this.kyberPreKeys.clear();
    }
    const changes = await DataWriter.removeAllKyberPreKeys();
    log.info(`clearKyberPreKeyStore: Removed ${changes} kyber prekeys`);
  }

  // PreKeys

  async loadPreKey(
    ourServiceId: ServiceIdString,
    keyId: number
  ): Promise<PreKeyRecord | undefined> {
    if (!this.preKeys) {
      throw new Error('loadPreKey: this.preKeys not yet cached!');
    }

    const id: PreKeyIdType = this.#_getKeyId(ourServiceId, keyId);
    const entry = this.preKeys.get(id);
    if (!entry) {
      log.error('Failed to fetch prekey:', id);
      return undefined;
    }

    if (entry.hydrated) {
      log.info('Successfully fetched prekey (cache hit):', id);
      return entry.item;
    }

    const item = hydratePreKey(entry.fromDB);
    this.preKeys.set(id, {
      hydrated: true,
      fromDB: entry.fromDB,
      item,
    });
    log.info('Successfully fetched prekey (cache miss):', id);
    return item;
  }

  loadPreKeys(ourServiceId: ServiceIdString): Array<PreKeyType> {
    if (!this.preKeys) {
      throw new Error('loadPreKeys: this.preKeys not yet cached!');
    }

    if (arguments.length > 1) {
      throw new Error('loadPreKeys takes one argument');
    }

    const entries = Array.from(this.preKeys.values());
    return entries
      .map(item => item.fromDB)
      .filter(item => item.ourServiceId === ourServiceId);
  }

  async storePreKeys(
    ourServiceId: ServiceIdString,
    keys: Array<CompatPreKeyType>
  ): Promise<void> {
    const preKeyCache = this.preKeys;
    if (!preKeyCache) {
      throw new Error('storePreKey: this.preKeys not yet cached!');
    }

    const now = Date.now();
    const toSave: Array<PreKeyType> = [];
    keys.forEach(key => {
      const id: PreKeyIdType = this.#_getKeyId(ourServiceId, key.keyId);

      if (preKeyCache.has(id)) {
        throw new Error(`storePreKeys: prekey ${id} already exists!`);
      }

      const preKey = {
        id,
        keyId: key.keyId,
        ourServiceId,
        publicKey: key.keyPair.pubKey,
        privateKey: key.keyPair.privKey,
        createdAt: now,
      };

      toSave.push(preKey);
    });

    log.info(`storePreKeys: Saving ${toSave.length} prekeys`);
    await DataWriter.bulkAddPreKeys(toSave);
    toSave.forEach(preKey => {
      preKeyCache.set(preKey.id, {
        hydrated: false,
        fromDB: preKey,
      });
    });
  }

  async removePreKeys(
    ourServiceId: ServiceIdString,
    keyIds: Array<number>
  ): Promise<void> {
    const preKeyCache = this.preKeys;
    if (!preKeyCache) {
      throw new Error('removePreKeys: this.preKeys not yet cached!');
    }

    const ids = keyIds.map(keyId => this.#_getKeyId(ourServiceId, keyId));

    log.info('removePreKeys: Removing prekeys:', formatKeys(keyIds));

    const changes = await DataWriter.removePreKeyById(ids);
    log.info(`removePreKeys: Removed ${changes} prekeys`);
    ids.forEach(id => {
      preKeyCache.delete(id);
    });

    if (preKeyCache.size < LOW_KEYS_THRESHOLD) {
      this.#emitLowKeys(ourServiceId, `removePreKeys@${preKeyCache.size}`);
    }
  }

  async clearPreKeyStore(): Promise<void> {
    if (this.preKeys) {
      this.preKeys.clear();
    }
    const changes = await DataWriter.removeAllPreKeys();
    log.info(`clearPreKeyStore: Removed ${changes} prekeys`);
  }

  // Signed PreKeys

  async loadSignedPreKey(
    ourServiceId: ServiceIdString,
    keyId: number
  ): Promise<SignedPreKeyRecord | undefined> {
    if (!this.signedPreKeys) {
      throw new Error('loadSignedPreKey: this.signedPreKeys not yet cached!');
    }

    const id: SignedPreKeyIdType = `${ourServiceId}:${keyId}`;

    const entry = this.signedPreKeys.get(id);
    if (!entry) {
      log.error('Failed to fetch signed prekey:', id);
      return undefined;
    }

    if (entry.hydrated) {
      log.info('Successfully fetched signed prekey (cache hit):', id);
      return entry.item;
    }

    const item = hydrateSignedPreKey(entry.fromDB);
    this.signedPreKeys.set(id, {
      hydrated: true,
      item,
      fromDB: entry.fromDB,
    });
    log.info('Successfully fetched signed prekey (cache miss):', id);
    return item;
  }

  loadSignedPreKeys(
    ourServiceId: ServiceIdString
  ): Array<OuterSignedPrekeyType> {
    if (!this.signedPreKeys) {
      throw new Error('loadSignedPreKeys: this.signedPreKeys not yet cached!');
    }

    if (arguments.length > 1) {
      throw new Error('loadSignedPreKeys takes one argument');
    }

    const entries = Array.from(this.signedPreKeys.values());
    return entries
      .filter(({ fromDB }) => fromDB.ourServiceId === ourServiceId)
      .map(entry => {
        const preKey = entry.fromDB;
        return {
          pubKey: preKey.publicKey,
          privKey: preKey.privateKey,
          created_at: preKey.created_at,
          keyId: preKey.keyId,
          confirmed: preKey.confirmed,
        };
      });
  }

  async confirmSignedPreKey(
    ourServiceId: ServiceIdString,
    keyId: number
  ): Promise<void> {
    const signedPreKeyCache = this.signedPreKeys;
    if (!signedPreKeyCache) {
      throw new Error('storeKyberPreKey: this.signedPreKeys not yet cached!');
    }

    const id: PreKeyIdType = this.#_getKeyId(ourServiceId, keyId);
    const item = signedPreKeyCache.get(id);
    if (!item) {
      throw new Error(`confirmSignedPreKey: missing prekey ${id}!`);
    }

    const confirmedItem = {
      ...item,
      fromDB: {
        ...item.fromDB,
        confirmed: true,
      },
    };

    await DataWriter.createOrUpdateSignedPreKey(confirmedItem.fromDB);
    signedPreKeyCache.set(id, confirmedItem);
  }

  async storeSignedPreKey(
    ourServiceId: ServiceIdString,
    keyId: number,
    keyPair: KeyPairType,
    confirmed?: boolean,
    createdAt = Date.now()
  ): Promise<void> {
    if (!this.signedPreKeys) {
      throw new Error('storeSignedPreKey: this.signedPreKeys not yet cached!');
    }

    const id: SignedPreKeyIdType = this.#_getKeyId(ourServiceId, keyId);

    const fromDB = {
      id,
      ourServiceId,
      keyId,
      publicKey: keyPair.pubKey,
      privateKey: keyPair.privKey,
      created_at: createdAt,
      confirmed: Boolean(confirmed),
    };

    await DataWriter.createOrUpdateSignedPreKey(fromDB);
    this.signedPreKeys.set(id, {
      hydrated: false,
      fromDB,
    });
  }

  async removeSignedPreKeys(
    ourServiceId: ServiceIdString,
    keyIds: Array<number>
  ): Promise<void> {
    const signedPreKeyCache = this.signedPreKeys;
    if (!signedPreKeyCache) {
      throw new Error('removeSignedPreKey: this.signedPreKeys not yet cached!');
    }

    const ids = keyIds.map(keyId => this.#_getKeyId(ourServiceId, keyId));

    log.info(
      'removeSignedPreKeys: Removing signed prekeys:',
      formatKeys(keyIds)
    );
    await DataWriter.removeSignedPreKeyById(ids);
    ids.forEach(id => {
      signedPreKeyCache.delete(id);
    });
  }

  async clearSignedPreKeysStore(): Promise<void> {
    if (this.signedPreKeys) {
      this.signedPreKeys.clear();
    }
    const changes = await DataWriter.removeAllSignedPreKeys();
    log.info(`clearSignedPreKeysStore: Removed ${changes} signed prekeys`);
  }

  // Sender Key

  // Re-entrant sender key transaction routine. Only one sender key transaction could
  // be running at the same time.
  //
  // While in transaction:
  //
  // - `saveSenderKey()` adds the updated session to the `pendingSenderKeys`
  // - `getSenderKey()` looks up the session first in `pendingSenderKeys` and only
  //   then in the main `senderKeys` store
  //
  // When transaction ends:
  //
  // - successfully: pending sender key stores are batched into the database
  // - with an error: pending sender key stores are reverted

  async enqueueSenderKeyJob<T>(
    qualifiedAddress: QualifiedAddress,
    task: () => Promise<T>,
    zone = GLOBAL_ZONE
  ): Promise<T> {
    return this.withZone(zone, 'enqueueSenderKeyJob', async () => {
      const queue = this.#_getSenderKeyQueue(qualifiedAddress);

      return queue.add<T>(task);
    });
  }

  #_createSenderKeyQueue(): PQueue {
    return new PQueue({
      concurrency: 1,
      timeout: MINUTE * 30,
      throwOnTimeout: true,
    });
  }

  #_getSenderKeyQueue(senderId: QualifiedAddress): PQueue {
    const cachedQueue = this.senderKeyQueues.get(senderId.toString());
    if (cachedQueue) {
      return cachedQueue;
    }

    const freshQueue = this.#_createSenderKeyQueue();
    this.senderKeyQueues.set(senderId.toString(), freshQueue);
    return freshQueue;
  }

  #getSenderKeyId(
    senderKeyId: QualifiedAddress,
    distributionId: string
  ): SenderKeyIdType {
    return `${senderKeyId.toString()}--${distributionId}`;
  }

  async saveSenderKey(
    qualifiedAddress: QualifiedAddress,
    distributionId: string,
    record: SenderKeyRecord,
    { zone = GLOBAL_ZONE }: SessionTransactionOptions = {}
  ): Promise<void> {
    await this.withZone(zone, 'saveSenderKey', async () => {
      if (!this.senderKeys) {
        throw new Error('saveSenderKey: this.senderKeys not yet cached!');
      }

      const senderId = qualifiedAddress.toString();

      try {
        const id = this.#getSenderKeyId(qualifiedAddress, distributionId);

        const fromDB: SenderKeyType = {
          id,
          senderId,
          distributionId,
          data: record.serialize(),
          lastUpdatedDate: Date.now(),
        };

        this.#pendingSenderKeys.set(id, {
          hydrated: true,
          fromDB,
          item: record,
        });

        // Current zone doesn't support pending sessions - commit immediately
        if (!zone.supportsPendingSenderKeys()) {
          await this.#commitZoneChanges('saveSenderKey');
        }
      } catch (error) {
        const errorString = Errors.toLogFormat(error);
        log.error(
          `saveSenderKey: failed to save senderKey ${senderId}/${distributionId}: ${errorString}`
        );
      }
    });
  }

  async getSenderKey(
    qualifiedAddress: QualifiedAddress,
    distributionId: string,
    { zone = GLOBAL_ZONE }: SessionTransactionOptions = {}
  ): Promise<SenderKeyRecord | undefined> {
    return this.withZone(zone, 'getSenderKey', async () => {
      if (!this.senderKeys) {
        throw new Error('getSenderKey: this.senderKeys not yet cached!');
      }

      const senderId = qualifiedAddress.toString();

      try {
        const id = this.#getSenderKeyId(qualifiedAddress, distributionId);

        const map = this.#pendingSenderKeys.has(id)
          ? this.#pendingSenderKeys
          : this.senderKeys;
        const entry = map.get(id);

        if (!entry) {
          log.error('Failed to fetch sender key:', id);
          return undefined;
        }

        if (entry.hydrated) {
          log.info('Successfully fetched sender key (cache hit):', id);
          return entry.item;
        }

        const item = SenderKeyRecord.deserialize(
          Buffer.from(entry.fromDB.data)
        );
        this.senderKeys.set(id, {
          hydrated: true,
          item,
          fromDB: entry.fromDB,
        });
        log.info('Successfully fetched sender key(cache miss):', id);
        return item;
      } catch (error) {
        const errorString = Errors.toLogFormat(error);
        log.error(
          `getSenderKey: failed to load sender key ${senderId}/${distributionId}: ${errorString}`
        );
        return undefined;
      }
    });
  }

  async removeSenderKey(
    qualifiedAddress: QualifiedAddress,
    distributionId: string
  ): Promise<void> {
    if (!this.senderKeys) {
      throw new Error('getSenderKey: this.senderKeys not yet cached!');
    }

    const senderId = qualifiedAddress.toString();

    try {
      const id = this.#getSenderKeyId(qualifiedAddress, distributionId);

      await DataWriter.removeSenderKeyById(id);

      this.senderKeys.delete(id);
    } catch (error) {
      const errorString = Errors.toLogFormat(error);
      log.error(
        `removeSenderKey: failed to remove senderKey ${senderId}/${distributionId}: ${errorString}`
      );
    }
  }

  async removeAllSenderKeys(): Promise<void> {
    return this.withZone(GLOBAL_ZONE, 'removeAllSenderKeys', async () => {
      if (this.senderKeys) {
        this.senderKeys.clear();
      }
      if (this.#pendingSenderKeys) {
        this.#pendingSenderKeys.clear();
      }
      await DataWriter.removeAllSenderKeys();
    });
  }

  // Session Queue

  async enqueueSessionJob<T>(
    qualifiedAddress: QualifiedAddress,
    name: string,
    task: () => Promise<T>,
    zone: Zone = GLOBAL_ZONE
  ): Promise<T> {
    this.sessionQueueJobCounter += 1;
    const id = this.sessionQueueJobCounter;

    const waitStart = Date.now();

    return this.withZone(zone, 'enqueueSessionJob', async () => {
      const queue = this.#_getSessionQueue(qualifiedAddress);

      const waitTime = Date.now() - waitStart;
      log.info(
        `enqueueSessionJob(${id}): queuing task ${name}, waited ${waitTime}ms`
      );
      const queueStart = Date.now();

      return queue.add<T>(() => {
        const queueTime = Date.now() - queueStart;
        log.info(
          `enqueueSessionJob(${id}): running task ${name}, waited ${queueTime}ms`
        );
        return task();
      });
    });
  }

  #_createSessionQueue(): PQueue {
    return new PQueue({
      concurrency: 1,
      timeout: MINUTE * 30,
      throwOnTimeout: true,
    });
  }

  #_getSessionQueue(id: QualifiedAddress): PQueue {
    const cachedQueue = this.sessionQueues.get(id.toString());
    if (cachedQueue) {
      return cachedQueue;
    }

    const freshQueue = this.#_createSessionQueue();
    this.sessionQueues.set(id.toString(), freshQueue);
    return freshQueue;
  }

  // Identity Queue

  #_createIdentityQueue(): PQueue {
    return new PQueue({
      concurrency: 1,
      timeout: MINUTE * 30,
      throwOnTimeout: true,
    });
  }

  #_runOnIdentityQueue<T>(
    serviceId: ServiceIdString,
    zone: Zone,
    name: string,
    body: () => Promise<T>
  ): Promise<T> {
    let queue: PQueue;

    const cachedQueue = this.#identityQueues.get(serviceId);
    if (cachedQueue) {
      queue = cachedQueue;
    } else {
      queue = this.#_createIdentityQueue();
      this.#identityQueues.set(serviceId, queue);
    }

    // We run the identity queue task in zone because `saveIdentity` needs to
    // be able to archive sibling sessions on keychange. Not entering the zone
    // now would mean that we can take locks in different order here and in
    // MessageReceiver which will lead to a deadlock.
    return this.withZone(zone, name, () => queue.add(body));
  }

  // Sessions

  // Re-entrant session transaction routine. Only one session transaction could
  // be running at the same time.
  //
  // While in transaction:
  //
  // - `storeSession()` adds the updated session to the `pendingSessions`
  // - `loadSession()` looks up the session first in `pendingSessions` and only
  //   then in the main `sessions` store
  //
  // When transaction ends:
  //
  // - successfully: pending session stores are batched into the database
  // - with an error: pending session stores are reverted

  public async withZone<T>(
    zone: Zone,
    name: string,
    body: () => Promise<T>
  ): Promise<T> {
    const debugName = `withZone(${zone.name}:${name})`;

    // Allow re-entering from LibSignalStores
    if (this.#currentZone && this.#currentZone !== zone) {
      const start = Date.now();

      log.info(`${debugName}: locked by ${this.#currentZone.name}, waiting`);

      return new Promise<T>((resolve, reject) => {
        const callback = async () => {
          const duration = Date.now() - start;
          log.info(`${debugName}: unlocked after ${duration}ms`);

          // Call `.withZone` synchronously from `this.zoneQueue` to avoid
          // extra in-between ticks while we are on microtasks queue.
          try {
            resolve(await this.withZone(zone, name, body));
          } catch (error) {
            reject(error);
          }
        };

        this.#zoneQueue.push({ zone, callback });
      });
    }

    this.#enterZone(zone, name);

    let result: T;
    try {
      result = await body();
    } catch (error) {
      if (this.#isInTopLevelZone()) {
        await this.#revertZoneChanges(name, error);
      }
      this.#leaveZone(zone);
      throw error;
    }

    if (this.#isInTopLevelZone()) {
      await this.#commitZoneChanges(name);
    }
    this.#leaveZone(zone);

    return result;
  }

  async #commitZoneChanges(name: string): Promise<void> {
    const pendingUnprocessed = this.#pendingUnprocessed;
    const pendingSenderKeys = this.#pendingSenderKeys;
    const pendingSessions = this.#pendingSessions;

    if (
      pendingSenderKeys.size === 0 &&
      pendingSessions.size === 0 &&
      pendingUnprocessed.size === 0
    ) {
      return;
    }

    log.info(
      `commitZoneChanges(${name}): ` +
        `pending sender keys ${pendingSenderKeys.size}, ` +
        `pending sessions ${pendingSessions.size}, ` +
        `pending unprocessed ${pendingUnprocessed.size}`
    );

    this.#pendingSenderKeys = new Map();
    this.#pendingSessions = new Map();
    this.#pendingUnprocessed = new Map();

    // Commit both sender keys, sessions and unprocessed in the same database transaction
    //   to unroll both on error.
    await DataWriter.commitDecryptResult({
      senderKeys: Array.from(pendingSenderKeys.values()).map(
        ({ fromDB }) => fromDB
      ),
      sessions: Array.from(pendingSessions.values()).map(
        ({ fromDB }) => fromDB
      ),
      unprocessed: Array.from(pendingUnprocessed.values()),
    });

    // Apply changes to in-memory storage after successful DB write.

    const { sessions } = this;
    assertDev(
      sessions !== undefined,
      "Can't commit unhydrated session storage"
    );
    pendingSessions.forEach((value, key) => {
      sessions.set(key, value);
    });

    const { senderKeys } = this;
    assertDev(
      senderKeys !== undefined,
      "Can't commit unhydrated sender key storage"
    );
    pendingSenderKeys.forEach((value, key) => {
      senderKeys.set(key, value);
    });
  }

  async #revertZoneChanges(name: string, error: Error): Promise<void> {
    log.info(
      `revertZoneChanges(${name}): ` +
        `pending sender keys size ${this.#pendingSenderKeys.size}, ` +
        `pending sessions size ${this.#pendingSessions.size}, ` +
        `pending unprocessed size ${this.#pendingUnprocessed.size}`,
      Errors.toLogFormat(error)
    );
    this.#pendingSenderKeys.clear();
    this.#pendingSessions.clear();
    this.#pendingUnprocessed.clear();
  }

  #isInTopLevelZone(): boolean {
    return this.#currentZoneDepth === 1;
  }

  #enterZone(zone: Zone, name: string): void {
    this.#currentZoneDepth += 1;
    if (this.#currentZoneDepth === 1) {
      assertDev(this.#currentZone === undefined, 'Should not be in the zone');
      this.#currentZone = zone;

      if (zone !== GLOBAL_ZONE) {
        log.info(`SignalProtocolStore.enterZone(${zone.name}:${name})`);
      }
    }
  }

  #leaveZone(zone: Zone): void {
    assertDev(this.#currentZone === zone, 'Should be in the correct zone');

    this.#currentZoneDepth -= 1;
    assertDev(
      this.#currentZoneDepth >= 0,
      'Unmatched number of leaveZone calls'
    );

    // Since we allow re-entering zones we might actually be in two overlapping
    // async calls. Leave the zone and yield to another one only if there are
    // no active zone users anymore.
    if (this.#currentZoneDepth !== 0) {
      return;
    }

    if (zone !== GLOBAL_ZONE) {
      log.info(`SignalProtocolStore.leaveZone(${zone.name})`);
    }

    this.#currentZone = undefined;

    const next = this.#zoneQueue.shift();
    if (!next) {
      return;
    }

    const toEnter = [next];

    while (this.#zoneQueue[0]?.zone === next.zone) {
      const elem = this.#zoneQueue.shift();
      assertDev(elem, 'Zone element should be present');

      toEnter.push(elem);
    }

    log.info(
      `SignalProtocolStore: running blocked ${toEnter.length} jobs in ` +
        `zone ${next.zone.name}`
    );
    for (const { callback } of toEnter) {
      callback();
    }
  }

  async loadSession(
    qualifiedAddress: QualifiedAddress,
    { zone = GLOBAL_ZONE }: SessionTransactionOptions = {}
  ): Promise<SessionRecord | undefined> {
    return this.withZone(zone, 'loadSession', async () => {
      if (!this.sessions) {
        throw new Error('loadSession: this.sessions not yet cached!');
      }

      if (qualifiedAddress == null) {
        throw new Error('loadSession: qualifiedAddress was undefined/null');
      }

      const id = qualifiedAddress.toString();

      try {
        const map = this.#pendingSessions.has(id)
          ? this.#pendingSessions
          : this.sessions;
        const entry = map.get(id);

        if (!entry) {
          return undefined;
        }

        if (entry.hydrated) {
          return entry.item;
        }

        const newItem = {
          hydrated: true,
          item: hydrateSession(entry.fromDB),
          fromDB: entry.fromDB,
        };
        map.set(id, newItem);

        return newItem.item;
      } catch (error) {
        const errorString = Errors.toLogFormat(error);
        log.error(`loadSession: failed to load session ${id}: ${errorString}`);
        return undefined;
      }
    });
  }

  async loadSessions(
    qualifiedAddresses: Array<QualifiedAddress>,
    { zone = GLOBAL_ZONE }: SessionTransactionOptions = {}
  ): Promise<Array<SessionRecord>> {
    return this.withZone(zone, 'loadSessions', async () => {
      const sessions = await Promise.all(
        qualifiedAddresses.map(async address =>
          this.loadSession(address, { zone })
        )
      );

      return sessions.filter(isNotNil);
    });
  }

  async storeSession(
    qualifiedAddress: QualifiedAddress,
    record: SessionRecord,
    { zone = GLOBAL_ZONE }: SessionTransactionOptions = {}
  ): Promise<void> {
    await this.withZone(zone, 'storeSession', async () => {
      if (!this.sessions) {
        throw new Error('storeSession: this.sessions not yet cached!');
      }

      if (qualifiedAddress == null) {
        throw new Error('storeSession: qualifiedAddress was undefined/null');
      }
      const { serviceId, deviceId } = qualifiedAddress;

      const conversation = window.ConversationController.lookupOrCreate({
        serviceId,
        reason: 'SignalProtocolStore.storeSession',
      });
      strictAssert(
        conversation !== undefined,
        'storeSession: Ensure contact ids failed'
      );
      const id = qualifiedAddress.toString();

      try {
        const fromDB = {
          id,
          version: 2,
          ourServiceId: qualifiedAddress.ourServiceId,
          conversationId: conversation.id,
          serviceId,
          deviceId,
          record: record.serialize(),
        };

        const newSession = {
          hydrated: true,
          fromDB,
          item: record,
        };

        assertDev(this.#currentZone, 'Must run in the zone');

        this.#pendingSessions.set(id, newSession);

        // Current zone doesn't support pending sessions - commit immediately
        if (!zone.supportsPendingSessions()) {
          await this.#commitZoneChanges('storeSession');
        }
      } catch (error) {
        const errorString = Errors.toLogFormat(error);
        log.error(`storeSession: Save failed for ${id}: ${errorString}`);
        throw error;
      }
    });
  }

  async hasSessionWith(serviceId: ServiceIdString): Promise<boolean> {
    return this.withZone(GLOBAL_ZONE, 'hasSessionWith', async () => {
      if (!this.sessions) {
        throw new Error('getOpenDevices: this.sessions not yet cached!');
      }

      return this.#_getAllSessions().some(
        ({ fromDB }) => fromDB.serviceId === serviceId
      );
    });
  }

  async getOpenDevices(
    ourServiceId: ServiceIdString,
    serviceIds: ReadonlyArray<ServiceIdString>,
    { zone = GLOBAL_ZONE }: SessionTransactionOptions = {}
  ): Promise<{
    devices: Array<DeviceType>;
    emptyServiceIds: Array<ServiceIdString>;
  }> {
    return this.withZone(zone, 'getOpenDevices', async () => {
      if (!this.sessions) {
        throw new Error('getOpenDevices: this.sessions not yet cached!');
      }
      if (serviceIds.length === 0) {
        return { devices: [], emptyServiceIds: [] };
      }

      try {
        const serviceIdSet = new Set(serviceIds);

        const allSessions = this.#_getAllSessions();
        const entries = allSessions.filter(
          ({ fromDB }) =>
            fromDB.ourServiceId === ourServiceId &&
            serviceIdSet.has(fromDB.serviceId)
        );
        const openEntries: Array<
          | undefined
          | {
              entry: SessionCacheEntry;
              record: SessionRecord;
            }
        > = await Promise.all(
          entries.map(async entry => {
            if (entry.hydrated) {
              const record = entry.item;
              if (record.hasCurrentState()) {
                return { record, entry };
              }

              return undefined;
            }

            const record = hydrateSession(entry.fromDB);
            if (record.hasCurrentState()) {
              return { record, entry };
            }

            return undefined;
          })
        );

        const devices = openEntries
          .map(item => {
            if (!item) {
              return undefined;
            }
            const { entry, record } = item;

            const { serviceId } = entry.fromDB;
            serviceIdSet.delete(serviceId);

            const id = entry.fromDB.deviceId;

            const registrationId = record.remoteRegistrationId();

            return {
              serviceId,
              id,
              registrationId,
            };
          })
          .filter(isNotNil);
        const emptyServiceIds = Array.from(serviceIdSet.values());

        return {
          devices,
          emptyServiceIds,
        };
      } catch (error) {
        log.error(
          'getOpenDevices: Failed to get devices',
          Errors.toLogFormat(error)
        );
        throw error;
      }
    });
  }

  async getDeviceIds({
    ourServiceId,
    serviceId,
  }: Readonly<{
    ourServiceId: ServiceIdString;
    serviceId: ServiceIdString;
  }>): Promise<Array<number>> {
    const { devices } = await this.getOpenDevices(ourServiceId, [serviceId]);
    return devices.map((device: DeviceType) => device.id);
  }

  async removeSession(qualifiedAddress: QualifiedAddress): Promise<void> {
    return this.withZone(GLOBAL_ZONE, 'removeSession', async () => {
      if (!this.sessions) {
        throw new Error('removeSession: this.sessions not yet cached!');
      }

      const id = qualifiedAddress.toString();
      log.info('removeSession: deleting session for', id);
      try {
        await DataWriter.removeSessionById(id);
        this.sessions.delete(id);
        this.#pendingSessions.delete(id);
      } catch (e) {
        log.error(`removeSession: Failed to delete session for ${id}`);
      }
    });
  }

  async removeSessionsByConversation(identifier: string): Promise<void> {
    return this.withZone(
      GLOBAL_ZONE,
      'removeSessionsByConversation',
      async () => {
        if (!this.sessions) {
          throw new Error(
            'removeSessionsByConversation: this.sessions not yet cached!'
          );
        }

        if (identifier == null) {
          throw new Error(
            'removeSessionsByConversation: identifier was undefined/null'
          );
        }

        log.info(
          'removeSessionsByConversation: deleting sessions for',
          identifier
        );

        const id = window.ConversationController.getConversationId(identifier);
        strictAssert(
          id,
          `removeSessionsByConversation: Conversation not found: ${identifier}`
        );

        const entries = Array.from(this.sessions.values());

        for (let i = 0, max = entries.length; i < max; i += 1) {
          const entry = entries[i];
          if (entry.fromDB.conversationId === id) {
            this.sessions.delete(entry.fromDB.id);
            this.#pendingSessions.delete(entry.fromDB.id);
          }
        }

        await DataWriter.removeSessionsByConversation(id);
      }
    );
  }

  async removeSessionsByServiceId(serviceId: ServiceIdString): Promise<void> {
    return this.withZone(GLOBAL_ZONE, 'removeSessionsByServiceId', async () => {
      if (!this.sessions) {
        throw new Error(
          'removeSessionsByServiceId: this.sessions not yet cached!'
        );
      }

      log.info('removeSessionsByServiceId: deleting sessions for', serviceId);

      const entries = Array.from(this.sessions.values());

      for (let i = 0, max = entries.length; i < max; i += 1) {
        const entry = entries[i];
        if (entry.fromDB.serviceId === serviceId) {
          this.sessions.delete(entry.fromDB.id);
          this.#pendingSessions.delete(entry.fromDB.id);
        }
      }

      await DataWriter.removeSessionsByServiceId(serviceId);
    });
  }

  async #_archiveSession(entry?: SessionCacheEntry, zone?: Zone) {
    if (!entry) {
      return;
    }

    const addr = QualifiedAddress.parse(entry.fromDB.id);

    await this.enqueueSessionJob(
      addr,
      `_archiveSession(${addr.toString()})`,
      async () => {
        const item = entry.hydrated ? entry.item : hydrateSession(entry.fromDB);

        if (!item.hasCurrentState()) {
          return;
        }

        item.archiveCurrentState();

        await this.storeSession(addr, item, { zone });
      },
      zone
    );
  }

  async archiveSession(qualifiedAddress: QualifiedAddress): Promise<void> {
    return this.withZone(GLOBAL_ZONE, 'archiveSession', async () => {
      if (!this.sessions) {
        throw new Error('archiveSession: this.sessions not yet cached!');
      }

      const id = qualifiedAddress.toString();

      log.info(`archiveSession: session for ${id}`);

      const entry = this.#pendingSessions.get(id) || this.sessions.get(id);

      await this.#_archiveSession(entry);
    });
  }

  async archiveSiblingSessions(
    encodedAddress: Address,
    { zone = GLOBAL_ZONE }: SessionTransactionOptions = {}
  ): Promise<void> {
    return this.withZone(zone, 'archiveSiblingSessions', async () => {
      if (!this.sessions) {
        throw new Error(
          'archiveSiblingSessions: this.sessions not yet cached!'
        );
      }

      log.info(
        'archiveSiblingSessions: archiving sibling sessions for',
        encodedAddress.toString()
      );

      const { serviceId, deviceId } = encodedAddress;

      const allEntries = this.#_getAllSessions();
      const entries = allEntries.filter(
        entry =>
          entry.fromDB.serviceId === serviceId &&
          entry.fromDB.deviceId !== deviceId
      );

      await Promise.all(
        entries.map(async entry => {
          await this.#_archiveSession(entry, zone);
        })
      );
    });
  }

  async archiveAllSessions(serviceId: ServiceIdString): Promise<void> {
    return this.withZone(GLOBAL_ZONE, 'archiveAllSessions', async () => {
      if (!this.sessions) {
        throw new Error('archiveAllSessions: this.sessions not yet cached!');
      }

      log.info('archiveAllSessions: archiving all sessions for', serviceId);

      const allEntries = this.#_getAllSessions();
      const entries = allEntries.filter(
        entry => entry.fromDB.serviceId === serviceId
      );

      await Promise.all(
        entries.map(async entry => {
          await this.#_archiveSession(entry);
        })
      );
    });
  }

  async clearSessionStore(): Promise<void> {
    return this.withZone(GLOBAL_ZONE, 'clearSessionStore', async () => {
      if (this.sessions) {
        this.sessions.clear();
      }
      this.#pendingSessions.clear();
      const changes = await DataWriter.removeAllSessions();
      log.info(`clearSessionStore: Removed ${changes} sessions`);
    });
  }

  async lightSessionReset(qualifiedAddress: QualifiedAddress): Promise<void> {
    const id = qualifiedAddress.toString();

    const sessionResets = window.storage.get(
      'sessionResets',
      {} as SessionResetsType
    );

    const lastReset = sessionResets[id];

    const ONE_HOUR = 60 * 60 * 1000;
    if (lastReset && isMoreRecentThan(lastReset, ONE_HOUR)) {
      log.warn(
        `lightSessionReset/${id}: Skipping session reset, last reset at ${lastReset}`
      );
      return;
    }

    sessionResets[id] = Date.now();
    await window.storage.put('sessionResets', sessionResets);

    try {
      const { serviceId } = qualifiedAddress;

      // First, fetch this conversation
      const conversation = window.ConversationController.lookupOrCreate({
        serviceId,
        reason: 'SignalProtocolStore.lightSessionReset',
      });
      assertDev(conversation, `lightSessionReset/${id}: missing conversation`);

      log.warn(`lightSessionReset/${id}: Resetting session`);

      // Archive open session with this device
      await this.archiveSession(qualifiedAddress);

      // Enqueue a null message with newly-created session
      await conversationJobQueue.add({
        type: 'NullMessage',
        conversationId: conversation.id,
        idForTracking: id,
      });
    } catch (error) {
      // If we failed to queue the session reset, then we'll allow another attempt sooner
      //   than one hour from now.
      delete sessionResets[id];
      await window.storage.put('sessionResets', sessionResets);

      log.error(
        `lightSessionReset/${id}: Encountered error`,
        Errors.toLogFormat(error)
      );
    }
  }

  // Identity Keys

  getIdentityRecord(serviceId: ServiceIdString): IdentityKeyType | undefined {
    if (!this.identityKeys) {
      throw new Error('getIdentityRecord: this.identityKeys not yet cached!');
    }

    try {
      const entry = this.identityKeys.get(serviceId);
      if (!entry) {
        return undefined;
      }

      return entry.fromDB;
    } catch (e) {
      log.error(
        `getIdentityRecord: Failed to get identity record for serviceId ${serviceId}`
      );
      return undefined;
    }
  }

  async getOrMigrateIdentityRecord(
    serviceId: ServiceIdString
  ): Promise<IdentityKeyType | undefined> {
    if (!this.identityKeys) {
      throw new Error(
        'getOrMigrateIdentityRecord: this.identityKeys not yet cached!'
      );
    }

    const result = this.getIdentityRecord(serviceId);
    if (result) {
      return result;
    }

    const newId = serviceId;
    const conversation = window.ConversationController.get(newId);
    if (!conversation) {
      return undefined;
    }

    const conversationId = conversation.id;
    const record = this.identityKeys.get(`conversation:${conversationId}`);
    if (!record) {
      return undefined;
    }

    const newRecord = {
      ...record.fromDB,
      id: newId,
    };

    log.info(
      `SignalProtocolStore: migrating identity key from ${record.fromDB.id} ` +
        `to ${newRecord.id}`
    );

    await this.#_saveIdentityKey(newRecord);

    this.identityKeys.delete(record.fromDB.id);
    const changes = await DataWriter.removeIdentityKeyById(record.fromDB.id);

    log.info(
      `getOrMigrateIdentityRecord: Removed ${changes} old identity keys for ${record.fromDB.id}`
    );

    return newRecord;
  }

  // https://github.com/signalapp/Signal-Android/blob/fc3db538bcaa38dc149712a483d3032c9c1f3998/app/src/main/java/org/thoughtcrime/securesms/crypto/storage/SignalBaseIdentityKeyStore.java#L128
  async isTrustedIdentity(
    encodedAddress: Address,
    publicKey: Uint8Array,
    direction: number
  ): Promise<boolean> {
    if (!this.identityKeys) {
      throw new Error('isTrustedIdentity: this.identityKeys not yet cached!');
    }

    if (encodedAddress == null) {
      throw new Error('isTrustedIdentity: encodedAddress was undefined/null');
    }
    const isOurIdentifier = window.textsecure.storage.user.isOurServiceId(
      encodedAddress.serviceId
    );

    const identityRecord = await this.getOrMigrateIdentityRecord(
      encodedAddress.serviceId
    );

    if (isOurIdentifier) {
      if (identityRecord && identityRecord.publicKey) {
        return constantTimeEqual(identityRecord.publicKey, publicKey);
      }
      log.warn(
        'isTrustedIdentity: No local record for our own identifier. Returning true.'
      );
      return true;
    }

    switch (direction) {
      case Direction.Sending:
        return this.isTrustedForSending(
          encodedAddress.serviceId,
          publicKey,
          identityRecord
        );
      case Direction.Receiving:
        return true;
      default:
        throw new Error(`isTrustedIdentity: Unknown direction: ${direction}`);
    }
  }

  // https://github.com/signalapp/Signal-Android/blob/fc3db538bcaa38dc149712a483d3032c9c1f3998/app/src/main/java/org/thoughtcrime/securesms/crypto/storage/SignalBaseIdentityKeyStore.java#L233
  isTrustedForSending(
    serviceId: ServiceIdString,
    publicKey: Uint8Array,
    identityRecord?: IdentityKeyType
  ): boolean {
    if (!identityRecord) {
      // To track key changes across session switches, we save an old identity key on the
      //   conversation.
      const conversation = window.ConversationController.get(serviceId);
      const previousIdentityKeyBase64 = conversation?.get(
        'previousIdentityKey'
      );
      if (conversation && previousIdentityKeyBase64) {
        const previousIdentityKey = Bytes.fromBase64(previousIdentityKeyBase64);

        if (!constantTimeEqual(previousIdentityKey, publicKey)) {
          log.info(
            'isTrustedForSending: previousIdentityKey does not match, returning false'
          );
          return false;
        }
      }

      log.info(
        'isTrustedForSending: No previous record or previousIdentityKey, returning true'
      );
      return true;
    }

    const existing = identityRecord.publicKey;

    if (!existing) {
      log.info('isTrustedForSending: Nothing here, returning true...');
      return true;
    }
    if (!constantTimeEqual(existing, publicKey)) {
      log.info("isTrustedForSending: Identity keys don't match...");
      return false;
    }
    if (identityRecord.verified === VerifiedStatus.UNVERIFIED) {
      log.error('isTrustedForSending: Needs unverified approval!');
      return false;
    }
    if (this.#isNonBlockingApprovalRequired(identityRecord)) {
      log.error('isTrustedForSending: Needs non-blocking approval!');
      return false;
    }

    return true;
  }

  async loadIdentityKey(
    serviceId: ServiceIdString
  ): Promise<Uint8Array | undefined> {
    if (serviceId == null) {
      throw new Error('loadIdentityKey: serviceId was undefined/null');
    }
    const identityRecord = await this.getOrMigrateIdentityRecord(serviceId);

    if (identityRecord) {
      return identityRecord.publicKey;
    }

    return undefined;
  }

  async getFingerprint(
    serviceId: ServiceIdString
  ): Promise<string | undefined> {
    if (serviceId == null) {
      throw new Error('loadIdentityKey: serviceId was undefined/null');
    }

    const pubKey = await this.loadIdentityKey(serviceId);

    if (!pubKey) {
      return;
    }

    const hash = sha256(pubKey);
    const fingerprint = hash.slice(0, 4);

    return Bytes.toBase64(fingerprint);
  }

  async #_saveIdentityKey(data: IdentityKeyType): Promise<void> {
    if (!this.identityKeys) {
      throw new Error('_saveIdentityKey: this.identityKeys not yet cached!');
    }

    const { id } = data;

    await DataWriter.createOrUpdateIdentityKey(data);
    this.identityKeys.set(id, {
      hydrated: false,
      fromDB: data,
    });
  }

  // https://github.com/signalapp/Signal-Android/blob/fc3db538bcaa38dc149712a483d3032c9c1f3998/app/src/main/java/org/thoughtcrime/securesms/crypto/storage/SignalBaseIdentityKeyStore.java#L69
  async saveIdentity(
    encodedAddress: Address,
    publicKey: Uint8Array,
    nonblockingApproval = false,
    { zone = GLOBAL_ZONE, noOverwrite = false }: SaveIdentityOptions = {}
  ): Promise<boolean> {
    if (!this.identityKeys) {
      throw new Error('saveIdentity: this.identityKeys not yet cached!');
    }

    if (encodedAddress == null) {
      throw new Error('saveIdentity: encodedAddress was undefined/null');
    }
    if (!(publicKey instanceof Uint8Array)) {
      // eslint-disable-next-line no-param-reassign
      publicKey = Bytes.fromBinary(publicKey);
    }
    if (typeof nonblockingApproval !== 'boolean') {
      // eslint-disable-next-line no-param-reassign
      nonblockingApproval = false;
    }

    return this.#_runOnIdentityQueue(
      encodedAddress.serviceId,
      zone,
      'saveIdentity',
      async () => {
        const identityRecord = await this.getOrMigrateIdentityRecord(
          encodedAddress.serviceId
        );

        const id = encodedAddress.serviceId;
        const logId = `saveIdentity(${id})`;

        if (!identityRecord || !identityRecord.publicKey) {
          // Lookup failed, or the current key was removed, so save this one.
          log.info(`${logId}: Saving new identity...`);
          await this.#_saveIdentityKey({
            id,
            publicKey,
            firstUse: true,
            timestamp: Date.now(),
            verified: VerifiedStatus.DEFAULT,
            nonblockingApproval,
          });

          this.checkPreviousKey(
            encodedAddress.serviceId,
            publicKey,
            'saveIdentity'
          );

          return false;
        }

        if (noOverwrite) {
          return false;
        }

        const identityKeyChanged = !constantTimeEqual(
          identityRecord.publicKey,
          publicKey
        );

        if (identityKeyChanged) {
          const isOurIdentifier = window.textsecure.storage.user.isOurServiceId(
            encodedAddress.serviceId
          );

          if (isOurIdentifier && identityKeyChanged) {
            log.warn(`${logId}: ignoring identity for ourselves`);
            return false;
          }

          log.info(`${logId}: Replacing existing identity...`);
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

          await this.#_saveIdentityKey({
            id,
            publicKey,
            firstUse: false,
            timestamp: Date.now(),
            verified: verifiedStatus,
            nonblockingApproval,
          });

          // See `addKeyChange` in `ts/models/conversations.ts` for sender key info
          // update caused by this.
          try {
            this.emit(
              'keychange',
              encodedAddress.serviceId,
              'saveIdentity - change'
            );
          } catch (error) {
            log.error(
              `${logId}: error triggering keychange:`,
              Errors.toLogFormat(error)
            );
          }

          // Pass the zone to facilitate transactional session use in
          // MessageReceiver.ts
          await this.archiveSiblingSessions(encodedAddress, {
            zone,
          });

          return true;
        }
        if (this.#isNonBlockingApprovalRequired(identityRecord)) {
          log.info(`${logId}: Setting approval status...`);

          identityRecord.nonblockingApproval = nonblockingApproval;
          await this.#_saveIdentityKey(identityRecord);

          return false;
        }

        return false;
      }
    );
  }

  // https://github.com/signalapp/Signal-Android/blob/fc3db538bcaa38dc149712a483d3032c9c1f3998/app/src/main/java/org/thoughtcrime/securesms/crypto/storage/SignalBaseIdentityKeyStore.java#L257
  #isNonBlockingApprovalRequired(identityRecord: IdentityKeyType): boolean {
    return (
      !identityRecord.firstUse &&
      isMoreRecentThan(identityRecord.timestamp, TIMESTAMP_THRESHOLD) &&
      !identityRecord.nonblockingApproval
    );
  }

  async saveIdentityWithAttributes(
    serviceId: ServiceIdString,
    attributes: Partial<IdentityKeyType>
  ): Promise<void> {
    return this.#_runOnIdentityQueue(
      serviceId,
      GLOBAL_ZONE,
      'saveIdentityWithAttributes',
      async () => {
        return this.#saveIdentityWithAttributesOnQueue(serviceId, attributes);
      }
    );
  }

  async #saveIdentityWithAttributesOnQueue(
    serviceId: ServiceIdString,
    attributes: Partial<IdentityKeyType>
  ): Promise<void> {
    if (serviceId == null) {
      throw new Error(
        'saveIdentityWithAttributes: serviceId was undefined/null'
      );
    }

    const identityRecord = await this.getOrMigrateIdentityRecord(serviceId);
    const id = serviceId;

    // When saving a PNI identity - don't create a separate conversation
    const serviceIdKind =
      window.textsecure.storage.user.getOurServiceIdKind(serviceId);
    if (serviceIdKind !== ServiceIdKind.PNI) {
      window.ConversationController.getOrCreate(id, 'private');
    }

    const updates: Partial<IdentityKeyType> = {
      ...identityRecord,
      ...attributes,
      id,
    };

    if (validateIdentityKey(updates)) {
      await this.#_saveIdentityKey(updates);
    }
  }

  async setApproval(
    serviceId: ServiceIdString,
    nonblockingApproval: boolean
  ): Promise<void> {
    if (serviceId == null) {
      throw new Error('setApproval: serviceId was undefined/null');
    }
    if (typeof nonblockingApproval !== 'boolean') {
      throw new Error('setApproval: Invalid approval status');
    }

    return this.#_runOnIdentityQueue(
      serviceId,
      GLOBAL_ZONE,
      'setApproval',
      async () => {
        const identityRecord = await this.getOrMigrateIdentityRecord(serviceId);

        if (!identityRecord) {
          throw new Error(`setApproval: No identity record for ${serviceId}`);
        }

        identityRecord.nonblockingApproval = nonblockingApproval;
        await this.#_saveIdentityKey(identityRecord);
      }
    );
  }

  // https://github.com/signalapp/Signal-Android/blob/fc3db538bcaa38dc149712a483d3032c9c1f3998/app/src/main/java/org/thoughtcrime/securesms/crypto/storage/SignalBaseIdentityKeyStore.java#L215
  // and https://github.com/signalapp/Signal-Android/blob/fc3db538bcaa38dc149712a483d3032c9c1f3998/app/src/main/java/org/thoughtcrime/securesms/verify/VerifyDisplayFragment.java#L544
  async setVerified(
    serviceId: ServiceIdString,
    verifiedStatus: number,
    extra: SetVerifiedExtra = {}
  ): Promise<void> {
    if (serviceId == null) {
      throw new Error('setVerified: serviceId was undefined/null');
    }
    if (!validateVerifiedStatus(verifiedStatus)) {
      throw new Error('setVerified: Invalid verified status');
    }

    return this.#_runOnIdentityQueue(
      serviceId,
      GLOBAL_ZONE,
      'setVerified',
      async () => {
        const identityRecord = await this.getOrMigrateIdentityRecord(serviceId);

        if (!identityRecord) {
          throw new Error(`setVerified: No identity record for ${serviceId}`);
        }

        if (validateIdentityKey(identityRecord)) {
          await this.#_saveIdentityKey({
            ...identityRecord,
            ...extra,
            verified: verifiedStatus,
          });
        }
      }
    );
  }

  async getVerified(serviceId: ServiceIdString): Promise<number> {
    if (serviceId == null) {
      throw new Error('getVerified: serviceId was undefined/null');
    }

    const identityRecord = await this.getOrMigrateIdentityRecord(serviceId);
    if (!identityRecord) {
      throw new Error(`getVerified: No identity record for ${serviceId}`);
    }

    const verifiedStatus = identityRecord.verified;
    if (validateVerifiedStatus(verifiedStatus)) {
      return verifiedStatus;
    }

    return VerifiedStatus.DEFAULT;
  }

  // To track key changes across session switches, we save an old identity key on the
  //   conversation. Whenever we get a new identity key for that contact, we need to
  //   check it against that saved key - no need to pop a key change warning if it is
  //   the same!
  checkPreviousKey(
    serviceId: ServiceIdString,
    publicKey: Uint8Array,
    context: string
  ): void {
    const conversation = window.ConversationController.get(serviceId);
    const previousIdentityKeyBase64 = conversation?.get('previousIdentityKey');
    if (conversation && previousIdentityKeyBase64) {
      const previousIdentityKey = Bytes.fromBase64(previousIdentityKeyBase64);

      try {
        if (!constantTimeEqual(previousIdentityKey, publicKey)) {
          this.emit(
            'keychange',
            serviceId,
            `${context} - previousIdentityKey check`
          );
        }

        // We only want to clear previousIdentityKey on a match, or on successfully emit.
        conversation.set({ previousIdentityKey: undefined });
        drop(DataWriter.updateConversation(conversation.attributes));
      } catch (error) {
        log.error(
          'saveIdentity: error triggering keychange:',
          error && error.stack ? error.stack : error
        );
      }
    }
  }

  // See https://github.com/signalapp/Signal-Android/blob/fc3db538bcaa38dc149712a483d3032c9c1f3998/app/src/main/java/org/thoughtcrime/securesms/database/IdentityDatabase.java#L184
  async updateIdentityAfterSync(
    serviceId: ServiceIdString,
    verifiedStatus: number,
    publicKey: Uint8Array
  ): Promise<boolean> {
    strictAssert(
      validateVerifiedStatus(verifiedStatus),
      `Invalid verified status: ${verifiedStatus}`
    );

    return this.#_runOnIdentityQueue(
      serviceId,
      GLOBAL_ZONE,
      'updateIdentityAfterSync',
      async () => {
        const identityRecord = await this.getOrMigrateIdentityRecord(serviceId);
        const hadEntry = identityRecord !== undefined;
        const keyMatches = Boolean(
          identityRecord?.publicKey &&
            constantTimeEqual(publicKey, identityRecord.publicKey)
        );
        const statusMatches =
          keyMatches && verifiedStatus === identityRecord?.verified;

        if (!keyMatches || !statusMatches) {
          await this.#saveIdentityWithAttributesOnQueue(serviceId, {
            publicKey,
            verified: verifiedStatus,
            firstUse: !hadEntry,
            timestamp: Date.now(),
            nonblockingApproval: true,
          });
        }
        if (!hadEntry) {
          this.checkPreviousKey(
            serviceId,
            publicKey,
            'updateIdentityAfterSync'
          );
        } else if (hadEntry && !keyMatches) {
          try {
            this.emit(
              'keychange',
              serviceId,
              'updateIdentityAfterSync - change'
            );
          } catch (error) {
            log.error(
              'updateIdentityAfterSync: error triggering keychange:',
              Errors.toLogFormat(error)
            );
          }
        }

        // See: https://github.com/signalapp/Signal-Android/blob/fc3db538bcaa38dc149712a483d3032c9c1f3998/app/src/main/java/org/thoughtcrime/securesms/database/RecipientDatabase.kt#L921-L936
        if (
          verifiedStatus === VerifiedStatus.VERIFIED &&
          (!hadEntry || identityRecord?.verified !== VerifiedStatus.VERIFIED)
        ) {
          // Needs a notification.
          return true;
        }
        if (
          verifiedStatus !== VerifiedStatus.VERIFIED &&
          hadEntry &&
          identityRecord?.verified === VerifiedStatus.VERIFIED
        ) {
          // Needs a notification.
          return true;
        }
        return false;
      }
    );
  }

  isUntrusted(
    serviceId: ServiceIdString,
    timestampThreshold = TIMESTAMP_THRESHOLD
  ): boolean {
    if (serviceId == null) {
      throw new Error('isUntrusted: serviceId was undefined/null');
    }

    const identityRecord = this.getIdentityRecord(serviceId);
    if (!identityRecord) {
      throw new Error(`isUntrusted: No identity record for ${serviceId}`);
    }

    if (
      isMoreRecentThan(identityRecord.timestamp, timestampThreshold) &&
      !identityRecord.nonblockingApproval &&
      !identityRecord.firstUse
    ) {
      return true;
    }

    return false;
  }

  async removeIdentityKey(serviceId: ServiceIdString): Promise<void> {
    if (!this.identityKeys) {
      throw new Error('removeIdentityKey: this.identityKeys not yet cached!');
    }

    const id = serviceId;
    this.identityKeys.delete(id);
    await DataWriter.removeIdentityKeyById(serviceId);
    await this.removeSessionsByServiceId(serviceId);
  }

  // Not yet processed messages - for resiliency
  getUnprocessedCount(): Promise<number> {
    return this.withZone(GLOBAL_ZONE, 'getUnprocessedCount', async () => {
      return DataReader.getUnprocessedCount();
    });
  }

  getAllUnprocessedIds(): Promise<Array<string>> {
    return this.withZone(GLOBAL_ZONE, 'getAllUnprocessedIds', () => {
      return DataWriter.getAllUnprocessedIds();
    });
  }

  getUnprocessedByIdsAndIncrementAttempts(
    ids: ReadonlyArray<string>
  ): Promise<Array<UnprocessedType>> {
    return this.withZone(
      GLOBAL_ZONE,
      'getAllUnprocessedByIdsAndIncrementAttempts',
      async () => {
        return DataWriter.getUnprocessedByIdsAndIncrementAttempts(ids);
      }
    );
  }

  getUnprocessedById(id: string): Promise<UnprocessedType | undefined> {
    return this.withZone(GLOBAL_ZONE, 'getUnprocessedById', async () => {
      return DataReader.getUnprocessedById(id);
    });
  }

  addUnprocessed(
    data: UnprocessedType,
    { zone = GLOBAL_ZONE }: SessionTransactionOptions = {}
  ): Promise<void> {
    return this.withZone(zone, 'addUnprocessed', async () => {
      this.#pendingUnprocessed.set(data.id, data);

      // Current zone doesn't support pending unprocessed - commit immediately
      if (!zone.supportsPendingUnprocessed()) {
        await this.#commitZoneChanges('addUnprocessed');
      }
    });
  }

  addMultipleUnprocessed(
    array: Array<UnprocessedType>,
    { zone = GLOBAL_ZONE }: SessionTransactionOptions = {}
  ): Promise<void> {
    return this.withZone(zone, 'addMultipleUnprocessed', async () => {
      for (const elem of array) {
        this.#pendingUnprocessed.set(elem.id, elem);
      }
      // Current zone doesn't support pending unprocessed - commit immediately
      if (!zone.supportsPendingUnprocessed()) {
        await this.#commitZoneChanges('addMultipleUnprocessed');
      }
    });
  }

  removeUnprocessed(idOrArray: string | Array<string>): Promise<void> {
    return this.withZone(GLOBAL_ZONE, 'removeUnprocessed', async () => {
      await DataWriter.removeUnprocessed(idOrArray);
    });
  }

  /** only for testing */
  removeAllUnprocessed(): Promise<void> {
    log.info('removeAllUnprocessed');
    return this.withZone(GLOBAL_ZONE, 'removeAllUnprocessed', async () => {
      await DataWriter.removeAllUnprocessed();
    });
  }

  async removeOurOldPni(oldPni: PniString): Promise<void> {
    const { storage } = window;

    log.info(`SignalProtocolStore.removeOurOldPni(${oldPni})`);

    // Update caches
    this.#ourIdentityKeys.delete(oldPni);
    this.#ourRegistrationIds.delete(oldPni);

    const preKeyPrefix = `${oldPni}:`;
    if (this.preKeys) {
      for (const key of this.preKeys.keys()) {
        if (key.startsWith(preKeyPrefix)) {
          this.preKeys.delete(key);
        }
      }
    }
    if (this.signedPreKeys) {
      for (const key of this.signedPreKeys.keys()) {
        if (key.startsWith(preKeyPrefix)) {
          this.signedPreKeys.delete(key);
        }
      }
    }
    if (this.kyberPreKeys) {
      for (const key of this.kyberPreKeys.keys()) {
        if (key.startsWith(preKeyPrefix)) {
          this.kyberPreKeys.delete(key);
        }
      }
    }

    // Update database
    await Promise.all([
      storage.put(
        'identityKeyMap',
        omit(storage.get('identityKeyMap') || {}, oldPni)
      ),
      storage.put(
        'registrationIdMap',
        omit(storage.get('registrationIdMap') || {}, oldPni)
      ),
      DataWriter.removePreKeysByServiceId(oldPni),
      DataWriter.removeSignedPreKeysByServiceId(oldPni),
      DataWriter.removeKyberPreKeysByServiceId(oldPni),
    ]);
  }

  async updateOurPniKeyMaterial(
    pni: PniString,
    {
      identityKeyPair: identityBytes,
      lastResortKyberPreKey: lastResortKyberPreKeyBytes,
      signedPreKey: signedPreKeyBytes,
      registrationId,
    }: PniKeyMaterialType
  ): Promise<void> {
    const logId = `SignalProtocolStore.updateOurPniKeyMaterial(${pni})`;
    log.info(`${logId}: starting...`);

    const identityKeyPair = IdentityKeyPair.deserialize(
      Buffer.from(identityBytes)
    );
    const signedPreKey = SignedPreKeyRecord.deserialize(
      Buffer.from(signedPreKeyBytes)
    );
    const lastResortKyberPreKey = lastResortKyberPreKeyBytes
      ? KyberPreKeyRecord.deserialize(Buffer.from(lastResortKyberPreKeyBytes))
      : undefined;

    const { storage } = window;

    const pniPublicKey = identityKeyPair.publicKey.serialize();
    const pniPrivateKey = identityKeyPair.privateKey.serialize();

    // Update caches
    this.#ourIdentityKeys.set(pni, {
      pubKey: pniPublicKey,
      privKey: pniPrivateKey,
    });
    this.#ourRegistrationIds.set(pni, registrationId);

    // Update database
    await Promise.all<void>([
      storage.put('identityKeyMap', {
        ...(storage.get('identityKeyMap') || {}),
        [pni]: {
          pubKey: pniPublicKey,
          privKey: pniPrivateKey,
        },
      }),
      storage.put('registrationIdMap', {
        ...(storage.get('registrationIdMap') || {}),
        [pni]: registrationId,
      }),
      (async () => {
        const newId = signedPreKey.id() + 1;
        log.warn(`${logId}: Updating next signed pre key id to ${newId}`);
        await storage.put(SIGNED_PRE_KEY_ID_KEY[ServiceIdKind.PNI], newId);
      })(),
      this.storeSignedPreKey(
        pni,
        signedPreKey.id(),
        {
          privKey: signedPreKey.privateKey().serialize(),
          pubKey: signedPreKey.publicKey().serialize(),
        },
        true,
        signedPreKey.timestamp()
      ),
      (async () => {
        if (!lastResortKyberPreKey) {
          return;
        }
        const newId = lastResortKyberPreKey.id() + 1;
        log.warn(`${logId}: Updating next kyber pre key id to ${newId}`);
        await storage.put(KYBER_KEY_ID_KEY[ServiceIdKind.PNI], newId);
      })(),
      lastResortKyberPreKeyBytes && lastResortKyberPreKey
        ? this.storeKyberPreKeys(pni, [
            {
              createdAt: lastResortKyberPreKey.timestamp(),
              data: lastResortKyberPreKeyBytes,
              isConfirmed: true,
              isLastResort: true,
              keyId: lastResortKyberPreKey.id(),
              ourServiceId: pni,
            },
          ])
        : undefined,
    ]);
  }

  async removeAllData(): Promise<void> {
    await DataWriter.removeAll();
    await this.hydrateCaches();

    window.storage.reset();
    await window.storage.fetch();

    window.ConversationController.reset();
    await window.ConversationController.load();

    this.emit('removeAllData');
  }

  async removeAllConfiguration(): Promise<void> {
    // Conversations. These properties are not present in redux.
    window.getConversations().forEach(conversation => {
      conversation.unset('storageID');
      conversation.unset('needsStorageServiceSync');
      conversation.unset('storageUnknownFields');
      conversation.unset('senderKeyInfo');
    });

    await DataWriter.removeAllConfiguration();

    await this.hydrateCaches();

    window.storage.reset();
    await window.storage.fetch();
  }

  signAlternateIdentity(): PniSignatureMessageType | undefined {
    const ourAci = window.textsecure.storage.user.getCheckedAci();
    const ourPni = window.textsecure.storage.user.getPni();
    if (!ourPni) {
      log.error('signAlternateIdentity: No local pni');
      return undefined;
    }

    if (this.#cachedPniSignatureMessage?.pni === ourPni) {
      return this.#cachedPniSignatureMessage;
    }

    const aciKeyPair = this.getIdentityKeyPair(ourAci);
    const pniKeyPair = this.getIdentityKeyPair(ourPni);
    if (!aciKeyPair) {
      log.error('signAlternateIdentity: No local ACI key pair');
      return undefined;
    }
    if (!pniKeyPair) {
      log.error('signAlternateIdentity: No local PNI key pair');
      return undefined;
    }

    const pniIdentity = new IdentityKeyPair(
      PublicKey.deserialize(Buffer.from(pniKeyPair.pubKey)),
      PrivateKey.deserialize(Buffer.from(pniKeyPair.privKey))
    );
    const aciPubKey = PublicKey.deserialize(Buffer.from(aciKeyPair.pubKey));
    this.#cachedPniSignatureMessage = {
      pni: ourPni,
      signature: pniIdentity.signAlternateIdentity(aciPubKey),
    };

    return this.#cachedPniSignatureMessage;
  }

  async verifyAlternateIdentity({
    aci,
    pni,
    signature,
  }: VerifyAlternateIdentityOptionsType): Promise<boolean> {
    const logId = `SignalProtocolStore.verifyAlternateIdentity(${aci}, ${pni})`;
    const aciPublicKeyBytes = await this.loadIdentityKey(aci);
    if (!aciPublicKeyBytes) {
      log.warn(`${logId}: no ACI public key`);
      return false;
    }

    const pniPublicKeyBytes = await this.loadIdentityKey(pni);
    if (!pniPublicKeyBytes) {
      log.warn(`${logId}: no PNI public key`);
      return false;
    }

    const aciPublicKey = PublicKey.deserialize(Buffer.from(aciPublicKeyBytes));
    const pniPublicKey = PublicKey.deserialize(Buffer.from(pniPublicKeyBytes));

    return pniPublicKey.verifyAlternateIdentity(
      aciPublicKey,
      Buffer.from(signature)
    );
  }

  #_getAllSessions(): Array<SessionCacheEntry> {
    const union = new Map<string, SessionCacheEntry>();

    this.sessions?.forEach((value, key) => {
      union.set(key, value);
    });
    this.#pendingSessions.forEach((value, key) => {
      union.set(key, value);
    });

    return Array.from(union.values());
  }

  #emitLowKeys(ourServiceId: ServiceIdString, source: string) {
    const logId = `SignalProtocolStore.emitLowKeys/${source}:`;
    try {
      log.info(`${logId}: Emitting event`);
      this.emit('lowKeys', ourServiceId);
    } catch (error) {
      log.error(`${logId}: Error thrown from emit`, Errors.toLogFormat(error));
    }
  }

  //
  // EventEmitter types
  //

  public override on(
    name: 'lowKeys',
    handler: (ourServiceId: ServiceIdString) => unknown
  ): this;

  public override on(
    name: 'keychange',
    handler: (theirServiceId: ServiceIdString, reason: string) => unknown
  ): this;

  public override on(name: 'removeAllData', handler: () => unknown): this;

  public override on(
    eventName: string | symbol,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (...args: Array<any>) => void
  ): this {
    return super.on(eventName, listener);
  }

  public override emit(name: 'lowKeys', ourServiceid: ServiceIdString): boolean;

  public override emit(
    name: 'keychange',
    theirServiceId: ServiceIdString,
    reason: string
  ): boolean;

  public override emit(name: 'removeAllData'): boolean;

  public override emit(
    eventName: string | symbol,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: Array<any>
  ): boolean {
    return super.emit(eventName, ...args);
  }
}

export function getSignalProtocolStore(): SignalProtocolStore {
  return new SignalProtocolStore();
}

window.SignalProtocolStore = SignalProtocolStore;
