// Copyright 2016-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import { isNumber, omit } from 'lodash';
import { z } from 'zod';

import {
  Direction,
  IdentityKeyPair,
  PreKeyRecord,
  PrivateKey,
  PublicKey,
  SenderKeyRecord,
  SessionRecord,
  SignedPreKeyRecord,
} from '@signalapp/libsignal-client';

import * as Bytes from './Bytes';
import { constantTimeEqual } from './Crypto';
import { assert, strictAssert } from './util/assert';
import { isNotNil } from './util/isNotNil';
import { Zone } from './util/Zone';
import { isMoreRecentThan } from './util/timestamp';
import {
  sessionRecordToProtobuf,
  sessionStructureToBytes,
} from './util/sessionTranslation';
import type {
  DeviceType,
  IdentityKeyType,
  IdentityKeyIdType,
  KeyPairType,
  OuterSignedPrekeyType,
  PniKeyMaterialType,
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
  UnprocessedUpdateType,
} from './textsecure/Types.d';
import type { RemoveAllConfiguration } from './types/RemoveAllConfiguration';
import type { UUIDStringType } from './types/UUID';
import { UUID, UUIDKind } from './types/UUID';
import type { Address } from './types/Address';
import type { QualifiedAddressStringType } from './types/QualifiedAddress';
import { QualifiedAddress } from './types/QualifiedAddress';
import * as log from './logging/log';
import { singleProtoJobQueue } from './jobs/singleProtoJobQueue';
import * as Errors from './types/errors';
import MessageSender from './textsecure/SendMessage';
import { MINUTE } from './util/durations';

const TIMESTAMP_THRESHOLD = 5 * 1000; // 5 seconds

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
  identityKeySchema.parse(attrs);
  return true;
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
  | 'identityKeys'
  | 'preKeys'
  | 'senderKeys'
  | 'sessions'
  | 'signedPreKeys';

export type SessionTransactionOptions = {
  readonly zone?: Zone;
};

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
  return SessionRecord.deserialize(Buffer.from(session.record, 'base64'));
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

export function freezeSession(session: SessionRecord): string {
  return session.serialize().toString('base64');
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

// We add a this parameter to avoid an 'implicit any' error on the next line
const EventsMixin = function EventsMixin(this: unknown) {
  Object.assign(this, window.Backbone.Events);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any as typeof window.Backbone.EventsMixin;

type SessionCacheEntry = CacheEntryType<SessionType, SessionRecord>;
type SenderKeyCacheEntry = CacheEntryType<SenderKeyType, SenderKeyRecord>;

type ZoneQueueEntryType = Readonly<{
  zone: Zone;
  callback(): void;
}>;

export class SignalProtocolStore extends EventsMixin {
  // Enums used across the app

  VerifiedStatus = VerifiedStatus;

  // Cached values

  private ourIdentityKeys = new Map<UUIDStringType, KeyPairType>();

  private ourRegistrationIds = new Map<UUIDStringType, number>();

  identityKeys?: Map<
    IdentityKeyIdType,
    CacheEntryType<IdentityKeyType, PublicKey>
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

  private currentZone?: Zone;

  private currentZoneDepth = 0;

  private readonly zoneQueue: Array<ZoneQueueEntryType> = [];

  private pendingSessions = new Map<SessionIdType, SessionCacheEntry>();

  private pendingSenderKeys = new Map<SenderKeyIdType, SenderKeyCacheEntry>();

  private pendingUnprocessed = new Map<string, UnprocessedType>();

  async hydrateCaches(): Promise<void> {
    await Promise.all([
      (async () => {
        this.ourIdentityKeys.clear();
        const map = await window.Signal.Data.getItemById('identityKeyMap');
        if (!map) {
          return;
        }

        for (const key of Object.keys(map.value)) {
          const { privKey, pubKey } = map.value[key];
          this.ourIdentityKeys.set(new UUID(key).toString(), {
            privKey,
            pubKey,
          });
        }
      })(),
      (async () => {
        this.ourRegistrationIds.clear();
        const map = await window.Signal.Data.getItemById('registrationIdMap');
        if (!map) {
          return;
        }

        for (const key of Object.keys(map.value)) {
          this.ourRegistrationIds.set(new UUID(key).toString(), map.value[key]);
        }
      })(),
      _fillCaches<string, IdentityKeyType, PublicKey>(
        this,
        'identityKeys',
        window.Signal.Data.getAllIdentityKeys()
      ),
      _fillCaches<string, SessionType, SessionRecord>(
        this,
        'sessions',
        window.Signal.Data.getAllSessions()
      ),
      _fillCaches<string, PreKeyType, PreKeyRecord>(
        this,
        'preKeys',
        window.Signal.Data.getAllPreKeys()
      ),
      _fillCaches<string, SenderKeyType, SenderKeyRecord>(
        this,
        'senderKeys',
        window.Signal.Data.getAllSenderKeys()
      ),
      _fillCaches<string, SignedPreKeyType, SignedPreKeyRecord>(
        this,
        'signedPreKeys',
        window.Signal.Data.getAllSignedPreKeys()
      ),
    ]);
  }

  async getIdentityKeyPair(ourUuid: UUID): Promise<KeyPairType | undefined> {
    return this.ourIdentityKeys.get(ourUuid.toString());
  }

  async getLocalRegistrationId(ourUuid: UUID): Promise<number | undefined> {
    return this.ourRegistrationIds.get(ourUuid.toString());
  }

  // PreKeys

  async loadPreKey(
    ourUuid: UUID,
    keyId: number
  ): Promise<PreKeyRecord | undefined> {
    if (!this.preKeys) {
      throw new Error('loadPreKey: this.preKeys not yet cached!');
    }

    const id: PreKeyIdType = `${ourUuid.toString()}:${keyId}`;

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

  async storePreKey(
    ourUuid: UUID,
    keyId: number,
    keyPair: KeyPairType
  ): Promise<void> {
    if (!this.preKeys) {
      throw new Error('storePreKey: this.preKeys not yet cached!');
    }

    const id: PreKeyIdType = `${ourUuid.toString()}:${keyId}`;
    if (this.preKeys.has(id)) {
      throw new Error(`storePreKey: prekey ${id} already exists!`);
    }

    const fromDB = {
      id,
      keyId,
      ourUuid: ourUuid.toString(),
      publicKey: keyPair.pubKey,
      privateKey: keyPair.privKey,
    };

    await window.Signal.Data.createOrUpdatePreKey(fromDB);
    this.preKeys.set(id, {
      hydrated: false,
      fromDB,
    });
  }

  async removePreKey(ourUuid: UUID, keyId: number): Promise<void> {
    if (!this.preKeys) {
      throw new Error('removePreKey: this.preKeys not yet cached!');
    }

    const id: PreKeyIdType = `${ourUuid.toString()}:${keyId}`;

    try {
      this.trigger('removePreKey', ourUuid);
    } catch (error) {
      log.error(
        'removePreKey error triggering removePreKey:',
        error && error.stack ? error.stack : error
      );
    }

    this.preKeys.delete(id);
    await window.Signal.Data.removePreKeyById(id);
  }

  async clearPreKeyStore(): Promise<void> {
    if (this.preKeys) {
      this.preKeys.clear();
    }
    await window.Signal.Data.removeAllPreKeys();
  }

  // Signed PreKeys

  async loadSignedPreKey(
    ourUuid: UUID,
    keyId: number
  ): Promise<SignedPreKeyRecord | undefined> {
    if (!this.signedPreKeys) {
      throw new Error('loadSignedPreKey: this.signedPreKeys not yet cached!');
    }

    const id: SignedPreKeyIdType = `${ourUuid.toString()}:${keyId}`;

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

  async loadSignedPreKeys(
    ourUuid: UUID
  ): Promise<Array<OuterSignedPrekeyType>> {
    if (!this.signedPreKeys) {
      throw new Error('loadSignedPreKeys: this.signedPreKeys not yet cached!');
    }

    if (arguments.length > 1) {
      throw new Error('loadSignedPreKeys takes one argument');
    }

    const entries = Array.from(this.signedPreKeys.values());
    return entries
      .filter(({ fromDB }) => fromDB.ourUuid === ourUuid.toString())
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

  // Note that this is also called in update scenarios, for confirming that signed prekeys
  //   have indeed been accepted by the server.
  async storeSignedPreKey(
    ourUuid: UUID,
    keyId: number,
    keyPair: KeyPairType,
    confirmed?: boolean,
    createdAt = Date.now()
  ): Promise<void> {
    if (!this.signedPreKeys) {
      throw new Error('storeSignedPreKey: this.signedPreKeys not yet cached!');
    }

    const id: SignedPreKeyIdType = `${ourUuid.toString()}:${keyId}`;

    const fromDB = {
      id,
      ourUuid: ourUuid.toString(),
      keyId,
      publicKey: keyPair.pubKey,
      privateKey: keyPair.privKey,
      created_at: createdAt,
      confirmed: Boolean(confirmed),
    };

    await window.Signal.Data.createOrUpdateSignedPreKey(fromDB);
    this.signedPreKeys.set(id, {
      hydrated: false,
      fromDB,
    });
  }

  async removeSignedPreKey(ourUuid: UUID, keyId: number): Promise<void> {
    if (!this.signedPreKeys) {
      throw new Error('removeSignedPreKey: this.signedPreKeys not yet cached!');
    }

    const id: SignedPreKeyIdType = `${ourUuid.toString()}:${keyId}`;
    this.signedPreKeys.delete(id);
    await window.Signal.Data.removeSignedPreKeyById(id);
  }

  async clearSignedPreKeysStore(): Promise<void> {
    if (this.signedPreKeys) {
      this.signedPreKeys.clear();
    }
    await window.Signal.Data.removeAllSignedPreKeys();
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
      const queue = this._getSenderKeyQueue(qualifiedAddress);

      return queue.add<T>(task);
    });
  }

  private _createSenderKeyQueue(): PQueue {
    return new PQueue({
      concurrency: 1,
      timeout: MINUTE * 30,
      throwOnTimeout: true,
    });
  }

  private _getSenderKeyQueue(senderId: QualifiedAddress): PQueue {
    const cachedQueue = this.senderKeyQueues.get(senderId.toString());
    if (cachedQueue) {
      return cachedQueue;
    }

    const freshQueue = this._createSenderKeyQueue();
    this.senderKeyQueues.set(senderId.toString(), freshQueue);
    return freshQueue;
  }

  private getSenderKeyId(
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
        const id = this.getSenderKeyId(qualifiedAddress, distributionId);

        const fromDB: SenderKeyType = {
          id,
          senderId,
          distributionId,
          data: record.serialize(),
          lastUpdatedDate: Date.now(),
        };

        this.pendingSenderKeys.set(id, {
          hydrated: true,
          fromDB,
          item: record,
        });

        // Current zone doesn't support pending sessions - commit immediately
        if (!zone.supportsPendingSenderKeys()) {
          await this.commitZoneChanges('saveSenderKey');
        }
      } catch (error) {
        const errorString = error && error.stack ? error.stack : error;
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
        const id = this.getSenderKeyId(qualifiedAddress, distributionId);

        const map = this.pendingSenderKeys.has(id)
          ? this.pendingSenderKeys
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
        const errorString = error && error.stack ? error.stack : error;
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
      const id = this.getSenderKeyId(qualifiedAddress, distributionId);

      await window.Signal.Data.removeSenderKeyById(id);

      this.senderKeys.delete(id);
    } catch (error) {
      const errorString = error && error.stack ? error.stack : error;
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
      if (this.pendingSenderKeys) {
        this.pendingSenderKeys.clear();
      }
      await window.Signal.Data.removeAllSenderKeys();
    });
  }

  // Session Queue

  async enqueueSessionJob<T>(
    qualifiedAddress: QualifiedAddress,
    task: () => Promise<T>,
    zone: Zone = GLOBAL_ZONE
  ): Promise<T> {
    return this.withZone(zone, 'enqueueSessionJob', async () => {
      const queue = this._getSessionQueue(qualifiedAddress);

      return queue.add<T>(task);
    });
  }

  private _createSessionQueue(): PQueue {
    return new PQueue({
      concurrency: 1,
      timeout: MINUTE * 30,
      throwOnTimeout: true,
    });
  }

  private _getSessionQueue(id: QualifiedAddress): PQueue {
    const cachedQueue = this.sessionQueues.get(id.toString());
    if (cachedQueue) {
      return cachedQueue;
    }

    const freshQueue = this._createSessionQueue();
    this.sessionQueues.set(id.toString(), freshQueue);
    return freshQueue;
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
    if (this.currentZone && this.currentZone !== zone) {
      const start = Date.now();

      log.info(`${debugName}: locked by ${this.currentZone.name}, waiting`);

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

        this.zoneQueue.push({ zone, callback });
      });
    }

    this.enterZone(zone, name);

    let result: T;
    try {
      result = await body();
    } catch (error) {
      if (this.isInTopLevelZone()) {
        await this.revertZoneChanges(name, error);
      }
      this.leaveZone(zone);
      throw error;
    }

    if (this.isInTopLevelZone()) {
      await this.commitZoneChanges(name);
    }
    this.leaveZone(zone);

    return result;
  }

  private async commitZoneChanges(name: string): Promise<void> {
    const { pendingSenderKeys, pendingSessions, pendingUnprocessed } = this;

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

    this.pendingSenderKeys = new Map();
    this.pendingSessions = new Map();
    this.pendingUnprocessed = new Map();

    // Commit both sender keys, sessions and unprocessed in the same database transaction
    //   to unroll both on error.
    await window.Signal.Data.commitDecryptResult({
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
    assert(sessions !== undefined, "Can't commit unhydrated session storage");
    pendingSessions.forEach((value, key) => {
      sessions.set(key, value);
    });

    const { senderKeys } = this;
    assert(
      senderKeys !== undefined,
      "Can't commit unhydrated sender key storage"
    );
    pendingSenderKeys.forEach((value, key) => {
      senderKeys.set(key, value);
    });
  }

  private async revertZoneChanges(name: string, error: Error): Promise<void> {
    log.info(
      `revertZoneChanges(${name}): ` +
        `pending sender keys size ${this.pendingSenderKeys.size}, ` +
        `pending sessions size ${this.pendingSessions.size}, ` +
        `pending unprocessed size ${this.pendingUnprocessed.size}`,
      error && error.stack
    );
    this.pendingSenderKeys.clear();
    this.pendingSessions.clear();
    this.pendingUnprocessed.clear();
  }

  private isInTopLevelZone(): boolean {
    return this.currentZoneDepth === 1;
  }

  private enterZone(zone: Zone, name: string): void {
    this.currentZoneDepth += 1;
    if (this.currentZoneDepth === 1) {
      assert(this.currentZone === undefined, 'Should not be in the zone');
      this.currentZone = zone;

      if (zone !== GLOBAL_ZONE) {
        log.info(`SignalProtocolStore.enterZone(${zone.name}:${name})`);
      }
    }
  }

  private leaveZone(zone: Zone): void {
    assert(this.currentZone === zone, 'Should be in the correct zone');

    this.currentZoneDepth -= 1;
    assert(this.currentZoneDepth >= 0, 'Unmatched number of leaveZone calls');

    // Since we allow re-entering zones we might actually be in two overlapping
    // async calls. Leave the zone and yield to another one only if there are
    // no active zone users anymore.
    if (this.currentZoneDepth !== 0) {
      return;
    }

    if (zone !== GLOBAL_ZONE) {
      log.info(`SignalProtocolStore.leaveZone(${zone.name})`);
    }

    this.currentZone = undefined;

    const next = this.zoneQueue.shift();
    if (!next) {
      return;
    }

    const toEnter = [next];

    while (this.zoneQueue[0]?.zone === next.zone) {
      const elem = this.zoneQueue.shift();
      assert(elem, 'Zone element should be present');

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

      if (qualifiedAddress === null || qualifiedAddress === undefined) {
        throw new Error('loadSession: qualifiedAddress was undefined/null');
      }

      const id = qualifiedAddress.toString();

      try {
        const map = this.pendingSessions.has(id)
          ? this.pendingSessions
          : this.sessions;
        const entry = map.get(id);

        if (!entry) {
          return undefined;
        }

        if (entry.hydrated) {
          return entry.item;
        }

        // We'll either just hydrate the item or we'll fully migrate the session
        //   and save it to the database.
        return await this._maybeMigrateSession(entry.fromDB, { zone });
      } catch (error) {
        const errorString = error && error.stack ? error.stack : error;
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

  private async _maybeMigrateSession(
    session: SessionType,
    { zone = GLOBAL_ZONE }: SessionTransactionOptions = {}
  ): Promise<SessionRecord> {
    if (!this.sessions) {
      throw new Error('_maybeMigrateSession: this.sessions not yet cached!');
    }

    // Already migrated, hydrate and update cache
    if (session.version === 2) {
      const item = hydrateSession(session);

      const map = this.pendingSessions.has(session.id)
        ? this.pendingSessions
        : this.sessions;
      map.set(session.id, {
        hydrated: true,
        item,
        fromDB: session,
      });

      return item;
    }

    // Not yet converted, need to translate to new format and save
    if (session.version !== undefined) {
      throw new Error('_maybeMigrateSession: Unknown session version type!');
    }

    const ourUuid = new UUID(session.ourUuid);

    const keyPair = await this.getIdentityKeyPair(ourUuid);
    if (!keyPair) {
      throw new Error('_maybeMigrateSession: No identity key for ourself!');
    }

    const localRegistrationId = await this.getLocalRegistrationId(ourUuid);
    if (!isNumber(localRegistrationId)) {
      throw new Error('_maybeMigrateSession: No registration id for ourself!');
    }

    const localUserData = {
      identityKeyPublic: keyPair.pubKey,
      registrationId: localRegistrationId,
    };

    log.info(`_maybeMigrateSession: Migrating session with id ${session.id}`);
    const sessionProto = sessionRecordToProtobuf(
      JSON.parse(session.record),
      localUserData
    );
    const record = SessionRecord.deserialize(
      Buffer.from(sessionStructureToBytes(sessionProto))
    );

    await this.storeSession(QualifiedAddress.parse(session.id), record, {
      zone,
    });

    return record;
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

      if (qualifiedAddress === null || qualifiedAddress === undefined) {
        throw new Error('storeSession: qualifiedAddress was undefined/null');
      }
      const { uuid, deviceId } = qualifiedAddress;

      const conversation = window.ConversationController.lookupOrCreate({
        uuid: uuid.toString(),
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
          ourUuid: qualifiedAddress.ourUuid.toString(),
          conversationId: conversation.id,
          uuid: uuid.toString(),
          deviceId,
          record: record.serialize().toString('base64'),
        };

        const newSession = {
          hydrated: true,
          fromDB,
          item: record,
        };

        assert(this.currentZone, 'Must run in the zone');

        this.pendingSessions.set(id, newSession);

        // Current zone doesn't support pending sessions - commit immediately
        if (!zone.supportsPendingSessions()) {
          await this.commitZoneChanges('storeSession');
        }
      } catch (error) {
        const errorString = error && error.stack ? error.stack : error;
        log.error(`storeSession: Save failed for ${id}: ${errorString}`);
        throw error;
      }
    });
  }

  async getOpenDevices(
    ourUuid: UUID,
    identifiers: Array<string>,
    { zone = GLOBAL_ZONE }: SessionTransactionOptions = {}
  ): Promise<{
    devices: Array<DeviceType>;
    emptyIdentifiers: Array<string>;
  }> {
    return this.withZone(zone, 'getOpenDevices', async () => {
      if (!this.sessions) {
        throw new Error('getOpenDevices: this.sessions not yet cached!');
      }
      if (identifiers.length === 0) {
        return { devices: [], emptyIdentifiers: [] };
      }

      try {
        const uuidsOrIdentifiers = new Set(
          identifiers.map(
            identifier => UUID.lookup(identifier)?.toString() || identifier
          )
        );

        const allSessions = this._getAllSessions();
        const entries = allSessions.filter(
          ({ fromDB }) =>
            fromDB.ourUuid === ourUuid.toString() &&
            uuidsOrIdentifiers.has(fromDB.uuid)
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

            const record = await this._maybeMigrateSession(entry.fromDB, {
              zone,
            });
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

            const { uuid } = entry.fromDB;
            uuidsOrIdentifiers.delete(uuid);

            const id = entry.fromDB.deviceId;

            const registrationId = record.remoteRegistrationId();

            return {
              identifier: uuid,
              id,
              registrationId,
            };
          })
          .filter(isNotNil);
        const emptyIdentifiers = Array.from(uuidsOrIdentifiers.values());

        return {
          devices,
          emptyIdentifiers,
        };
      } catch (error) {
        log.error(
          'getOpenDevices: Failed to get devices',
          error && error.stack ? error.stack : error
        );
        throw error;
      }
    });
  }

  async getDeviceIds({
    ourUuid,
    identifier,
  }: Readonly<{
    ourUuid: UUID;
    identifier: string;
  }>): Promise<Array<number>> {
    const { devices } = await this.getOpenDevices(ourUuid, [identifier]);
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
        await window.Signal.Data.removeSessionById(id);
        this.sessions.delete(id);
        this.pendingSessions.delete(id);
      } catch (e) {
        log.error(`removeSession: Failed to delete session for ${id}`);
      }
    });
  }

  async removeAllSessions(identifier: string): Promise<void> {
    return this.withZone(GLOBAL_ZONE, 'removeAllSessions', async () => {
      if (!this.sessions) {
        throw new Error('removeAllSessions: this.sessions not yet cached!');
      }

      if (identifier === null || identifier === undefined) {
        throw new Error('removeAllSessions: identifier was undefined/null');
      }

      log.info('removeAllSessions: deleting sessions for', identifier);

      const id = window.ConversationController.getConversationId(identifier);
      strictAssert(
        id,
        `removeAllSessions: Conversation not found: ${identifier}`
      );

      const entries = Array.from(this.sessions.values());

      for (let i = 0, max = entries.length; i < max; i += 1) {
        const entry = entries[i];
        if (entry.fromDB.conversationId === id) {
          this.sessions.delete(entry.fromDB.id);
          this.pendingSessions.delete(entry.fromDB.id);
        }
      }

      await window.Signal.Data.removeSessionsByConversation(id);
    });
  }

  private async _archiveSession(entry?: SessionCacheEntry, zone?: Zone) {
    if (!entry) {
      return;
    }

    const addr = QualifiedAddress.parse(entry.fromDB.id);

    await this.enqueueSessionJob(
      addr,
      async () => {
        const item = entry.hydrated
          ? entry.item
          : await this._maybeMigrateSession(entry.fromDB, { zone });

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

      const entry = this.pendingSessions.get(id) || this.sessions.get(id);

      await this._archiveSession(entry);
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

      const { uuid, deviceId } = encodedAddress;

      const allEntries = this._getAllSessions();
      const entries = allEntries.filter(
        entry =>
          entry.fromDB.uuid === uuid.toString() &&
          entry.fromDB.deviceId !== deviceId
      );

      await Promise.all(
        entries.map(async entry => {
          await this._archiveSession(entry, zone);
        })
      );
    });
  }

  async archiveAllSessions(uuid: UUID): Promise<void> {
    return this.withZone(GLOBAL_ZONE, 'archiveAllSessions', async () => {
      if (!this.sessions) {
        throw new Error('archiveAllSessions: this.sessions not yet cached!');
      }

      log.info(
        'archiveAllSessions: archiving all sessions for',
        uuid.toString()
      );

      const allEntries = this._getAllSessions();
      const entries = allEntries.filter(
        entry => entry.fromDB.uuid === uuid.toString()
      );

      await Promise.all(
        entries.map(async entry => {
          await this._archiveSession(entry);
        })
      );
    });
  }

  async clearSessionStore(): Promise<void> {
    return this.withZone(GLOBAL_ZONE, 'clearSessionStore', async () => {
      if (this.sessions) {
        this.sessions.clear();
      }
      this.pendingSessions.clear();
      await window.Signal.Data.removeAllSessions();
    });
  }

  async lightSessionReset(qualifiedAddress: QualifiedAddress): Promise<void> {
    const id = qualifiedAddress.toString();

    const sessionResets = window.storage.get(
      'sessionResets',
      <SessionResetsType>{}
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
    window.storage.put('sessionResets', sessionResets);

    try {
      const { uuid } = qualifiedAddress;

      // First, fetch this conversation
      const conversation = window.ConversationController.lookupOrCreate({
        uuid: uuid.toString(),
      });
      assert(conversation, `lightSessionReset/${id}: missing conversation`);

      log.warn(`lightSessionReset/${id}: Resetting session`);

      // Archive open session with this device
      await this.archiveSession(qualifiedAddress);

      // Enqueue a null message with newly-created session
      await singleProtoJobQueue.add(
        MessageSender.getNullMessage({
          uuid: uuid.toString(),
        })
      );
    } catch (error) {
      // If we failed to do the session reset, then we'll allow another attempt sooner
      //   than one hour from now.
      delete sessionResets[id];
      window.storage.put('sessionResets', sessionResets);

      log.error(
        `lightSessionReset/${id}: Encountered error`,
        Errors.toLogFormat(error)
      );
    }
  }

  // Identity Keys

  getIdentityRecord(uuid: UUID): IdentityKeyType | undefined {
    if (!this.identityKeys) {
      throw new Error('getIdentityRecord: this.identityKeys not yet cached!');
    }

    const id = uuid.toString();

    try {
      const entry = this.identityKeys.get(id);
      if (!entry) {
        return undefined;
      }

      return entry.fromDB;
    } catch (e) {
      log.error(
        `getIdentityRecord: Failed to get identity record for identifier ${id}`
      );
      return undefined;
    }
  }

  async getOrMigrateIdentityRecord(
    uuid: UUID
  ): Promise<IdentityKeyType | undefined> {
    if (!this.identityKeys) {
      throw new Error(
        'getOrMigrateIdentityRecord: this.identityKeys not yet cached!'
      );
    }

    const result = this.getIdentityRecord(uuid);
    if (result) {
      return result;
    }

    const newId = uuid.toString();
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

    await this._saveIdentityKey(newRecord);

    this.identityKeys.delete(record.fromDB.id);
    await window.Signal.Data.removeIdentityKeyById(record.fromDB.id);

    return newRecord;
  }

  async isTrustedIdentity(
    encodedAddress: Address,
    publicKey: Uint8Array,
    direction: number
  ): Promise<boolean> {
    if (!this.identityKeys) {
      throw new Error('isTrustedIdentity: this.identityKeys not yet cached!');
    }

    if (encodedAddress === null || encodedAddress === undefined) {
      throw new Error('isTrustedIdentity: encodedAddress was undefined/null');
    }
    const ourUuid = window.textsecure.storage.user.getCheckedUuid();
    const isOurIdentifier = encodedAddress.uuid.isEqual(ourUuid);

    const identityRecord = await this.getOrMigrateIdentityRecord(
      encodedAddress.uuid
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
        return this.isTrustedForSending(publicKey, identityRecord);
      case Direction.Receiving:
        return true;
      default:
        throw new Error(`isTrustedIdentity: Unknown direction: ${direction}`);
    }
  }

  isTrustedForSending(
    publicKey: Uint8Array,
    identityRecord?: IdentityKeyType
  ): boolean {
    if (!identityRecord) {
      log.info('isTrustedForSending: No previous record, returning true...');
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
      log.error('isTrustedIdentity: Needs unverified approval!');
      return false;
    }
    if (this.isNonBlockingApprovalRequired(identityRecord)) {
      log.error('isTrustedForSending: Needs non-blocking approval!');
      return false;
    }

    return true;
  }

  async loadIdentityKey(uuid: UUID): Promise<Uint8Array | undefined> {
    if (uuid === null || uuid === undefined) {
      throw new Error('loadIdentityKey: uuid was undefined/null');
    }
    const identityRecord = await this.getOrMigrateIdentityRecord(uuid);

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

    await window.Signal.Data.createOrUpdateIdentityKey(data);
    this.identityKeys.set(id, {
      hydrated: false,
      fromDB: data,
    });
  }

  async saveIdentity(
    encodedAddress: Address,
    publicKey: Uint8Array,
    nonblockingApproval = false,
    { zone }: SessionTransactionOptions = {}
  ): Promise<boolean> {
    if (!this.identityKeys) {
      throw new Error('saveIdentity: this.identityKeys not yet cached!');
    }

    if (encodedAddress === null || encodedAddress === undefined) {
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

    const identityRecord = await this.getOrMigrateIdentityRecord(
      encodedAddress.uuid
    );

    const id = encodedAddress.uuid.toString();

    if (!identityRecord || !identityRecord.publicKey) {
      // Lookup failed, or the current key was removed, so save this one.
      log.info('saveIdentity: Saving new identity...');
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
      log.info('saveIdentity: Replacing existing identity...');
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
        this.trigger('keychange', encodedAddress.uuid);
      } catch (error) {
        log.error(
          'saveIdentity: error triggering keychange:',
          error && error.stack ? error.stack : error
        );
      }

      // Pass the zone to facilitate transactional session use in
      // MessageReceiver.ts
      await this.archiveSiblingSessions(encodedAddress, {
        zone,
      });

      return true;
    }
    if (this.isNonBlockingApprovalRequired(identityRecord)) {
      log.info('saveIdentity: Setting approval status...');

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
    uuid: UUID,
    attributes: Partial<IdentityKeyType>
  ): Promise<void> {
    if (uuid === null || uuid === undefined) {
      throw new Error('saveIdentityWithAttributes: uuid was undefined/null');
    }

    const identityRecord = await this.getOrMigrateIdentityRecord(uuid);
    const id = uuid.toString();

    // When saving a PNI identity - don't create a separate conversation
    const uuidKind = window.textsecure.storage.user.getOurUuidKind(uuid);
    if (uuidKind !== UUIDKind.PNI) {
      window.ConversationController.getOrCreate(id, 'private');
    }

    const updates: Partial<IdentityKeyType> = {
      ...identityRecord,
      ...attributes,
      id,
    };

    if (validateIdentityKey(updates)) {
      await this._saveIdentityKey(updates);
    }
  }

  async setApproval(uuid: UUID, nonblockingApproval: boolean): Promise<void> {
    if (uuid === null || uuid === undefined) {
      throw new Error('setApproval: uuid was undefined/null');
    }
    if (typeof nonblockingApproval !== 'boolean') {
      throw new Error('setApproval: Invalid approval status');
    }

    const identityRecord = await this.getOrMigrateIdentityRecord(uuid);

    if (!identityRecord) {
      throw new Error(`setApproval: No identity record for ${uuid}`);
    }

    identityRecord.nonblockingApproval = nonblockingApproval;
    await this._saveIdentityKey(identityRecord);
  }

  async setVerified(
    uuid: UUID,
    verifiedStatus: number,
    publicKey?: Uint8Array
  ): Promise<void> {
    if (uuid === null || uuid === undefined) {
      throw new Error('setVerified: uuid was undefined/null');
    }
    if (!validateVerifiedStatus(verifiedStatus)) {
      throw new Error('setVerified: Invalid verified status');
    }

    const identityRecord = await this.getOrMigrateIdentityRecord(uuid);

    if (!identityRecord) {
      throw new Error(`setVerified: No identity record for ${uuid.toString()}`);
    }

    if (!publicKey || constantTimeEqual(identityRecord.publicKey, publicKey)) {
      identityRecord.verified = verifiedStatus;

      if (validateIdentityKey(identityRecord)) {
        await this._saveIdentityKey(identityRecord);
      }
    } else {
      log.info('setVerified: No identity record for specified publicKey');
    }
  }

  async getVerified(uuid: UUID): Promise<number> {
    if (uuid === null || uuid === undefined) {
      throw new Error('getVerified: uuid was undefined/null');
    }

    const identityRecord = await this.getOrMigrateIdentityRecord(uuid);
    if (!identityRecord) {
      throw new Error(`getVerified: No identity record for ${uuid}`);
    }

    const verifiedStatus = identityRecord.verified;
    if (validateVerifiedStatus(verifiedStatus)) {
      return verifiedStatus;
    }

    return VerifiedStatus.DEFAULT;
  }

  // See https://github.com/signalapp/Signal-iOS-Private/blob/e32c2dff0d03f67467b4df621d84b11412d50cdb/SignalServiceKit/src/Messages/OWSIdentityManager.m#L317
  // for reference.
  async processVerifiedMessage(
    uuid: UUID,
    verifiedStatus: number,
    publicKey?: Uint8Array
  ): Promise<boolean> {
    if (uuid === null || uuid === undefined) {
      throw new Error('processVerifiedMessage: uuid was undefined/null');
    }
    if (!validateVerifiedStatus(verifiedStatus)) {
      throw new Error('processVerifiedMessage: Invalid verified status');
    }
    if (publicKey !== undefined && !(publicKey instanceof Uint8Array)) {
      throw new Error('processVerifiedMessage: Invalid public key');
    }

    const identityRecord = await this.getOrMigrateIdentityRecord(uuid);

    let isEqual = false;

    if (identityRecord && publicKey) {
      isEqual = constantTimeEqual(publicKey, identityRecord.publicKey);
    }

    // Just update verified status if the key is the same or not present
    if (isEqual || !publicKey) {
      await this.setVerified(uuid, verifiedStatus, publicKey);
      return false;
    }

    await this.saveIdentityWithAttributes(uuid, {
      publicKey,
      verified: verifiedStatus,
      firstUse: false,
      timestamp: Date.now(),
      nonblockingApproval: verifiedStatus === VerifiedStatus.VERIFIED,
    });

    if (identityRecord) {
      try {
        this.trigger('keychange', uuid);
      } catch (error) {
        log.error(
          'processVerifiedMessage error triggering keychange:',
          Errors.toLogFormat(error)
        );
      }

      // true signifies that we overwrote a previous key with a new one
      return true;
    }

    return false;
  }

  isUntrusted(uuid: UUID): boolean {
    if (uuid === null || uuid === undefined) {
      throw new Error('isUntrusted: uuid was undefined/null');
    }

    const identityRecord = this.getIdentityRecord(uuid);
    if (!identityRecord) {
      throw new Error(`isUntrusted: No identity record for ${uuid.toString()}`);
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

  async removeIdentityKey(uuid: UUID): Promise<void> {
    if (!this.identityKeys) {
      throw new Error('removeIdentityKey: this.identityKeys not yet cached!');
    }

    const id = uuid.toString();
    this.identityKeys.delete(id);
    await window.Signal.Data.removeIdentityKeyById(id);
    await this.removeAllSessions(id);
  }

  // Not yet processed messages - for resiliency
  getUnprocessedCount(): Promise<number> {
    return this.withZone(GLOBAL_ZONE, 'getUnprocessedCount', async () => {
      return window.Signal.Data.getUnprocessedCount();
    });
  }

  getAllUnprocessedAndIncrementAttempts(): Promise<Array<UnprocessedType>> {
    return this.withZone(GLOBAL_ZONE, 'getAllUnprocessed', async () => {
      return window.Signal.Data.getAllUnprocessedAndIncrementAttempts();
    });
  }

  getUnprocessedById(id: string): Promise<UnprocessedType | undefined> {
    return this.withZone(GLOBAL_ZONE, 'getUnprocessedById', async () => {
      return window.Signal.Data.getUnprocessedById(id);
    });
  }

  addUnprocessed(
    data: UnprocessedType,
    { zone = GLOBAL_ZONE }: SessionTransactionOptions = {}
  ): Promise<void> {
    return this.withZone(zone, 'addUnprocessed', async () => {
      this.pendingUnprocessed.set(data.id, data);

      // Current zone doesn't support pending unprocessed - commit immediately
      if (!zone.supportsPendingUnprocessed()) {
        await this.commitZoneChanges('addUnprocessed');
      }
    });
  }

  addMultipleUnprocessed(
    array: Array<UnprocessedType>,
    { zone = GLOBAL_ZONE }: SessionTransactionOptions = {}
  ): Promise<void> {
    return this.withZone(zone, 'addMultipleUnprocessed', async () => {
      for (const elem of array) {
        this.pendingUnprocessed.set(elem.id, elem);
      }
      // Current zone doesn't support pending unprocessed - commit immediately
      if (!zone.supportsPendingUnprocessed()) {
        await this.commitZoneChanges('addMultipleUnprocessed');
      }
    });
  }

  updateUnprocessedWithData(
    id: string,
    data: UnprocessedUpdateType
  ): Promise<void> {
    return this.withZone(GLOBAL_ZONE, 'updateUnprocessedWithData', async () => {
      await window.Signal.Data.updateUnprocessedWithData(id, data);
    });
  }

  updateUnprocessedsWithData(
    items: Array<{ id: string; data: UnprocessedUpdateType }>
  ): Promise<void> {
    return this.withZone(
      GLOBAL_ZONE,
      'updateUnprocessedsWithData',
      async () => {
        await window.Signal.Data.updateUnprocessedsWithData(items);
      }
    );
  }

  removeUnprocessed(idOrArray: string | Array<string>): Promise<void> {
    return this.withZone(GLOBAL_ZONE, 'removeUnprocessed', async () => {
      await window.Signal.Data.removeUnprocessed(idOrArray);
    });
  }

  removeAllUnprocessed(): Promise<void> {
    return this.withZone(GLOBAL_ZONE, 'removeAllUnprocessed', async () => {
      await window.Signal.Data.removeAllUnprocessed();
    });
  }

  async removeOurOldPni(oldPni: UUID): Promise<void> {
    const { storage } = window;

    log.info(`SignalProtocolStore.removeOurOldPni(${oldPni})`);

    // Update caches
    this.ourIdentityKeys.delete(oldPni.toString());
    this.ourRegistrationIds.delete(oldPni.toString());

    const preKeyPrefix = `${oldPni.toString()}:`;
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

    // Update database
    await Promise.all([
      storage.put(
        'identityKeyMap',
        omit(storage.get('identityKeyMap') || {}, oldPni.toString())
      ),
      storage.put(
        'registrationIdMap',
        omit(storage.get('registrationIdMap') || {}, oldPni.toString())
      ),
      window.Signal.Data.removePreKeysByUuid(oldPni.toString()),
      window.Signal.Data.removeSignedPreKeysByUuid(oldPni.toString()),
    ]);
  }

  async updateOurPniKeyMaterial(
    pni: UUID,
    {
      identityKeyPair: identityBytes,
      signedPreKey: signedPreKeyBytes,
      registrationId,
    }: PniKeyMaterialType
  ): Promise<void> {
    log.info(`SignalProtocolStore.updateOurPniKeyMaterial(${pni})`);

    const identityKeyPair = IdentityKeyPair.deserialize(
      Buffer.from(identityBytes)
    );
    const signedPreKey = SignedPreKeyRecord.deserialize(
      Buffer.from(signedPreKeyBytes)
    );

    const { storage } = window;

    const pniPublicKey = identityKeyPair.publicKey.serialize();
    const pniPrivateKey = identityKeyPair.privateKey.serialize();

    // Update caches
    this.ourIdentityKeys.set(pni.toString(), {
      pubKey: pniPublicKey,
      privKey: pniPrivateKey,
    });
    this.ourRegistrationIds.set(pni.toString(), registrationId);

    // Update database
    await Promise.all([
      storage.put('identityKeyMap', {
        ...(storage.get('identityKeyMap') || {}),
        [pni.toString()]: {
          pubKey: pniPublicKey,
          privKey: pniPrivateKey,
        },
      }),
      storage.put('registrationIdMap', {
        ...(storage.get('registrationIdMap') || {}),
        [pni.toString()]: registrationId,
      }),
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
    ]);
  }

  async removeAllData(): Promise<void> {
    await window.Signal.Data.removeAll();
    await this.hydrateCaches();

    window.storage.reset();
    await window.storage.fetch();

    window.ConversationController.reset();
    await window.ConversationController.load();
  }

  async removeAllConfiguration(mode: RemoveAllConfiguration): Promise<void> {
    await window.Signal.Data.removeAllConfiguration(mode);
    await this.hydrateCaches();

    window.storage.reset();
    await window.storage.fetch();
  }

  private _getAllSessions(): Array<SessionCacheEntry> {
    const union = new Map<string, SessionCacheEntry>();

    this.sessions?.forEach((value, key) => {
      union.set(key, value);
    });
    this.pendingSessions.forEach((value, key) => {
      union.set(key, value);
    });

    return Array.from(union.values());
  }
}

window.SignalProtocolStore = SignalProtocolStore;
