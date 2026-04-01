// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';

import type {
  Aci,
  Direction,
  KyberPreKeyRecord,
  PreKeyRecord,
  ProtocolAddress,
  SenderKeyRecord,
  SessionRecord,
  SignedPreKeyRecord,
  Uuid,
  PrivateKey,
  IdentityChange,
  IdentityKeyPair,
} from '@signalapp/libsignal-client';
import {
  IdentityKeyStore,
  KyberPreKeyStore,
  PreKeyStore,
  PublicKey,
  SenderKeyStore,
  SessionStore,
  SignedPreKeyStore,
} from '@signalapp/libsignal-client';
import type { Store as KeyTransparencyStoreInterface } from '@signalapp/libsignal-client/dist/net/KeyTransparency.d.ts';
import { Address } from './types/Address.std.ts';
import { QualifiedAddress } from './types/QualifiedAddress.std.ts';
import type { ServiceIdString } from './types/ServiceId.std.ts';
import { normalizeServiceId } from './types/ServiceId.std.ts';
import type { SignalProtocolStore } from './SignalProtocolStore.preload.ts';

import type { Zone } from './util/Zone.std.ts';

const { isNumber } = lodash;

function encodeAddress(address: ProtocolAddress): Address {
  const name = address.name();
  const deviceId = address.deviceId();
  return Address.create(normalizeServiceId(name, 'encodeAddress'), deviceId);
}

function toQualifiedAddress(
  ourServiceId: ServiceIdString,
  address: ProtocolAddress
): QualifiedAddress {
  return new QualifiedAddress(ourServiceId, encodeAddress(address));
}

export type SessionsOptions = Readonly<{
  signalProtocolStore: SignalProtocolStore;
  ourServiceId: ServiceIdString;
  zone?: Zone;
}>;

export class Sessions extends SessionStore {
  readonly #signalProtocolStore: SignalProtocolStore;
  readonly #ourServiceId: ServiceIdString;
  readonly #zone: Zone | undefined;

  constructor({ signalProtocolStore, ourServiceId, zone }: SessionsOptions) {
    super();

    this.#signalProtocolStore = signalProtocolStore;
    this.#ourServiceId = ourServiceId;
    this.#zone = zone;
  }

  async saveSession(
    address: ProtocolAddress,
    record: SessionRecord
  ): Promise<void> {
    await this.#signalProtocolStore.storeSession(
      toQualifiedAddress(this.#ourServiceId, address),
      record,
      { zone: this.#zone }
    );
  }

  async getSession(name: ProtocolAddress): Promise<SessionRecord | null> {
    const encodedAddress = toQualifiedAddress(this.#ourServiceId, name);
    const record = await this.#signalProtocolStore.loadSession(encodedAddress, {
      zone: this.#zone,
    });

    return record || null;
  }

  async getExistingSessions(
    addresses: Array<ProtocolAddress>
  ): Promise<Array<SessionRecord>> {
    const encodedAddresses = addresses.map(addr =>
      toQualifiedAddress(this.#ourServiceId, addr)
    );
    return this.#signalProtocolStore.loadSessions(encodedAddresses, {
      zone: this.#zone,
    });
  }
}

export type IdentityKeysOptions = Readonly<{
  signalProtocolStore: SignalProtocolStore;
  ourServiceId: ServiceIdString;
  zone?: Zone;
}>;

// oxlint-disable-next-line max-classes-per-file
export class IdentityKeys extends IdentityKeyStore {
  readonly #signalProtocolStore: SignalProtocolStore;
  readonly #ourServiceId: ServiceIdString;
  readonly #zone: Zone | undefined;

  constructor({
    signalProtocolStore,
    ourServiceId,
    zone,
  }: IdentityKeysOptions) {
    super();

    this.#signalProtocolStore = signalProtocolStore;
    this.#ourServiceId = ourServiceId;
    this.#zone = zone;
  }

  async getIdentityKey(): Promise<PrivateKey> {
    return (await this.getIdentityKeyPair()).privateKey;
  }

  override async getIdentityKeyPair(): Promise<IdentityKeyPair> {
    const keyPair = this.#signalProtocolStore.getIdentityKeyPair(
      this.#ourServiceId
    );
    if (!keyPair) {
      throw new Error('IdentityKeyStore/getIdentityKey: No identity key!');
    }
    return keyPair;
  }

  async getLocalRegistrationId(): Promise<number> {
    const id = await this.#signalProtocolStore.getLocalRegistrationId(
      this.#ourServiceId
    );
    if (!isNumber(id)) {
      throw new Error(
        'IdentityKeyStore/getLocalRegistrationId: No registration id!'
      );
    }
    return id;
  }

  async getIdentity(address: ProtocolAddress): Promise<PublicKey | null> {
    const encodedAddress = encodeAddress(address);
    const key = await this.#signalProtocolStore.loadIdentityKey(
      encodedAddress.serviceId
    );

    if (!key) {
      return null;
    }

    return PublicKey.deserialize(key);
  }

  async saveIdentity(
    name: ProtocolAddress,
    key: PublicKey
  ): Promise<IdentityChange> {
    const encodedAddress = encodeAddress(name);
    const publicKey = key.serialize();

    // Pass `zone` to let `saveIdentity` archive sibling sessions when identity
    // key changes.
    return this.#signalProtocolStore.saveIdentity(
      encodedAddress,
      publicKey,
      false,
      {
        zone: this.#zone,
      }
    );
  }

  async isTrustedIdentity(
    name: ProtocolAddress,
    key: PublicKey,
    direction: Direction
  ): Promise<boolean> {
    const encodedAddress = encodeAddress(name);
    const publicKey = key.serialize();

    return this.#signalProtocolStore.isTrustedIdentity(
      encodedAddress,
      publicKey,
      direction
    );
  }
}

export type PreKeysOptions = Readonly<{
  signalProtocolStore: SignalProtocolStore;
  ourServiceId: ServiceIdString;
  zone?: Zone;
}>;

export class PreKeys extends PreKeyStore {
  readonly #signalProtocolStore: SignalProtocolStore;
  readonly #ourServiceId: ServiceIdString;
  readonly #zone: Zone | undefined;

  constructor({ signalProtocolStore, ourServiceId, zone }: PreKeysOptions) {
    super();
    this.#signalProtocolStore = signalProtocolStore;
    this.#ourServiceId = ourServiceId;
    this.#zone = zone;
  }

  async savePreKey(): Promise<void> {
    throw new Error('savePreKey: Should not be called by libsignal!');
  }

  async getPreKey(id: number): Promise<PreKeyRecord> {
    const preKey = await this.#signalProtocolStore.loadPreKey(
      this.#ourServiceId,
      id
    );

    if (preKey === undefined) {
      throw new Error(`getPreKey: PreKey ${id} not found`);
    }

    return preKey;
  }

  async removePreKey(id: number): Promise<void> {
    await this.#signalProtocolStore.removePreKeys(this.#ourServiceId, [id], {
      zone: this.#zone,
    });
  }
}

export class KyberPreKeys extends KyberPreKeyStore {
  readonly #signalProtocolStore: SignalProtocolStore;
  readonly #ourServiceId: ServiceIdString;
  readonly #zone: Zone | undefined;

  constructor({ signalProtocolStore, ourServiceId, zone }: PreKeysOptions) {
    super();
    this.#signalProtocolStore = signalProtocolStore;
    this.#ourServiceId = ourServiceId;
    this.#zone = zone;
  }

  async saveKyberPreKey(): Promise<void> {
    throw new Error('saveKyberPreKey: Should not be called by libsignal!');
  }

  async getKyberPreKey(id: number): Promise<KyberPreKeyRecord> {
    const kyberPreKey = await this.#signalProtocolStore.loadKyberPreKey(
      this.#ourServiceId,
      id
    );

    if (kyberPreKey === undefined) {
      throw new Error(`getKyberPreKey: KyberPreKey ${id} not found`);
    }

    return kyberPreKey;
  }

  async markKyberPreKeyUsed(
    keyId: number,
    signedPreKeyId: number,
    baseKey: PublicKey
  ): Promise<void> {
    await this.#signalProtocolStore.maybeRemoveKyberPreKey(
      this.#ourServiceId,
      { keyId, signedPreKeyId, baseKey },
      { zone: this.#zone }
    );
  }
}

export type SenderKeysOptions = Readonly<{
  signalProtocolStore: SignalProtocolStore;
  ourServiceId: ServiceIdString;
  zone: Zone | undefined;
}>;

export class SenderKeys extends SenderKeyStore {
  readonly #signalProtocolStore: SignalProtocolStore;
  readonly #ourServiceId: ServiceIdString;
  readonly zone: Zone | undefined;

  constructor({ signalProtocolStore, ourServiceId, zone }: SenderKeysOptions) {
    super();
    this.#signalProtocolStore = signalProtocolStore;
    this.#ourServiceId = ourServiceId;
    this.zone = zone;
  }

  async saveSenderKey(
    sender: ProtocolAddress,
    distributionId: Uuid,
    record: SenderKeyRecord
  ): Promise<void> {
    const encodedAddress = toQualifiedAddress(this.#ourServiceId, sender);

    await this.#signalProtocolStore.saveSenderKey(
      encodedAddress,
      distributionId,
      record,
      { zone: this.zone }
    );
  }

  async getSenderKey(
    sender: ProtocolAddress,
    distributionId: Uuid
  ): Promise<SenderKeyRecord | null> {
    const encodedAddress = toQualifiedAddress(this.#ourServiceId, sender);

    const senderKey = await this.#signalProtocolStore.getSenderKey(
      encodedAddress,
      distributionId,
      { zone: this.zone }
    );

    return senderKey || null;
  }
}

export type SignedPreKeysOptions = Readonly<{
  signalProtocolStore: SignalProtocolStore;
  ourServiceId: ServiceIdString;
}>;

// No need for zone awareness, since no mutation happens in this store
export class SignedPreKeys extends SignedPreKeyStore {
  readonly #signalProtocolStore: SignalProtocolStore;
  readonly #ourServiceId: ServiceIdString;

  constructor({ signalProtocolStore, ourServiceId }: SignedPreKeysOptions) {
    super();
    this.#signalProtocolStore = signalProtocolStore;
    this.#ourServiceId = ourServiceId;
  }

  async saveSignedPreKey(): Promise<void> {
    throw new Error('saveSignedPreKey: Should not be called by libsignal!');
  }

  async getSignedPreKey(id: number): Promise<SignedPreKeyRecord> {
    const signedPreKey = await this.#signalProtocolStore.loadSignedPreKey(
      this.#ourServiceId,
      id
    );

    if (!signedPreKey) {
      throw new Error(`getSignedPreKey: SignedPreKey ${id} not found`);
    }

    return signedPreKey;
  }
}

export class KeyTransparencyStore implements KeyTransparencyStoreInterface {
  readonly #signalProtocolStore: SignalProtocolStore;

  constructor(signalProtocolStore: SignalProtocolStore) {
    this.#signalProtocolStore = signalProtocolStore;
  }

  async getLastDistinguishedTreeHead(): Promise<Uint8Array<ArrayBuffer> | null> {
    return this.#signalProtocolStore.getLastDistinguishedTreeHead();
  }

  async setLastDistinguishedTreeHead(
    bytes: Readonly<Uint8Array<ArrayBuffer>> | null
  ): Promise<void> {
    return this.#signalProtocolStore.setLastDistinguishedTreeHead(bytes);
  }

  async getAccountData(aci: Aci): Promise<Uint8Array<ArrayBuffer> | null> {
    return this.#signalProtocolStore.getKTAccountData(aci);
  }

  async setAccountData(
    aci: Aci,
    bytes: Readonly<Uint8Array<ArrayBuffer>>
  ): Promise<void> {
    return this.#signalProtocolStore.setKTAccountData(aci, bytes);
  }
}
