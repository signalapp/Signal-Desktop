// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import lodash from 'lodash';

import type {
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
import { Address } from './types/Address.std.js';
import { QualifiedAddress } from './types/QualifiedAddress.std.js';
import type { ServiceIdString } from './types/ServiceId.std.js';
import { normalizeServiceId } from './types/ServiceId.std.js';
import { signalProtocolStore } from './SignalProtocolStore.preload.js';

import type { Zone } from './util/Zone.std.js';

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
  ourServiceId: ServiceIdString;
  zone?: Zone;
}>;

export class Sessions extends SessionStore {
  readonly #ourServiceId: ServiceIdString;
  readonly #zone: Zone | undefined;

  constructor({ ourServiceId, zone }: SessionsOptions) {
    super();

    this.#ourServiceId = ourServiceId;
    this.#zone = zone;
  }

  async saveSession(
    address: ProtocolAddress,
    record: SessionRecord
  ): Promise<void> {
    await signalProtocolStore.storeSession(
      toQualifiedAddress(this.#ourServiceId, address),
      record,
      { zone: this.#zone }
    );
  }

  async getSession(name: ProtocolAddress): Promise<SessionRecord | null> {
    const encodedAddress = toQualifiedAddress(this.#ourServiceId, name);
    const record = await signalProtocolStore.loadSession(encodedAddress, {
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
    return signalProtocolStore.loadSessions(encodedAddresses, {
      zone: this.#zone,
    });
  }
}

export type IdentityKeysOptions = Readonly<{
  ourServiceId: ServiceIdString;
  zone?: Zone;
}>;

export class IdentityKeys extends IdentityKeyStore {
  readonly #ourServiceId: ServiceIdString;
  readonly #zone: Zone | undefined;

  constructor({ ourServiceId, zone }: IdentityKeysOptions) {
    super();

    this.#ourServiceId = ourServiceId;
    this.#zone = zone;
  }

  async getIdentityKey(): Promise<PrivateKey> {
    const keyPair = signalProtocolStore.getIdentityKeyPair(this.#ourServiceId);
    if (!keyPair) {
      throw new Error('IdentityKeyStore/getIdentityKey: No identity key!');
    }
    return keyPair.privateKey;
  }

  async getLocalRegistrationId(): Promise<number> {
    const id = await signalProtocolStore.getLocalRegistrationId(
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
    const key = await signalProtocolStore.loadIdentityKey(
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
    return signalProtocolStore.saveIdentity(encodedAddress, publicKey, false, {
      zone: this.#zone,
    });
  }

  async isTrustedIdentity(
    name: ProtocolAddress,
    key: PublicKey,
    direction: Direction
  ): Promise<boolean> {
    const encodedAddress = encodeAddress(name);
    const publicKey = key.serialize();

    return signalProtocolStore.isTrustedIdentity(
      encodedAddress,
      publicKey,
      direction
    );
  }
}

export type PreKeysOptions = Readonly<{
  ourServiceId: ServiceIdString;
  zone?: Zone;
}>;

export class PreKeys extends PreKeyStore {
  readonly #ourServiceId: ServiceIdString;
  readonly #zone: Zone | undefined;

  constructor({ ourServiceId, zone }: PreKeysOptions) {
    super();
    this.#ourServiceId = ourServiceId;
    this.#zone = zone;
  }

  async savePreKey(): Promise<void> {
    throw new Error('savePreKey: Should not be called by libsignal!');
  }

  async getPreKey(id: number): Promise<PreKeyRecord> {
    const preKey = await signalProtocolStore.loadPreKey(this.#ourServiceId, id);

    if (preKey === undefined) {
      throw new Error(`getPreKey: PreKey ${id} not found`);
    }

    return preKey;
  }

  async removePreKey(id: number): Promise<void> {
    await signalProtocolStore.removePreKeys(this.#ourServiceId, [id], {
      zone: this.#zone,
    });
  }
}

export class KyberPreKeys extends KyberPreKeyStore {
  readonly #ourServiceId: ServiceIdString;
  readonly #zone: Zone | undefined;

  constructor({ ourServiceId, zone }: PreKeysOptions) {
    super();
    this.#ourServiceId = ourServiceId;
    this.#zone = zone;
  }

  async saveKyberPreKey(): Promise<void> {
    throw new Error('saveKyberPreKey: Should not be called by libsignal!');
  }

  async getKyberPreKey(id: number): Promise<KyberPreKeyRecord> {
    const kyberPreKey = await signalProtocolStore.loadKyberPreKey(
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
    await signalProtocolStore.maybeRemoveKyberPreKey(
      this.#ourServiceId,
      { keyId, signedPreKeyId, baseKey },
      { zone: this.#zone }
    );
  }
}

export type SenderKeysOptions = Readonly<{
  readonly ourServiceId: ServiceIdString;
  readonly zone: Zone | undefined;
}>;

export class SenderKeys extends SenderKeyStore {
  readonly #ourServiceId: ServiceIdString;
  readonly zone: Zone | undefined;

  constructor({ ourServiceId, zone }: SenderKeysOptions) {
    super();
    this.#ourServiceId = ourServiceId;
    this.zone = zone;
  }

  async saveSenderKey(
    sender: ProtocolAddress,
    distributionId: Uuid,
    record: SenderKeyRecord
  ): Promise<void> {
    const encodedAddress = toQualifiedAddress(this.#ourServiceId, sender);

    await signalProtocolStore.saveSenderKey(
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

    const senderKey = await signalProtocolStore.getSenderKey(
      encodedAddress,
      distributionId,
      { zone: this.zone }
    );

    return senderKey || null;
  }
}

export type SignedPreKeysOptions = Readonly<{
  ourServiceId: ServiceIdString;
}>;

// No need for zone awareness, since no mutation happens in this store
export class SignedPreKeys extends SignedPreKeyStore {
  readonly #ourServiceId: ServiceIdString;

  constructor({ ourServiceId }: SignedPreKeysOptions) {
    super();
    this.#ourServiceId = ourServiceId;
  }

  async saveSignedPreKey(): Promise<void> {
    throw new Error('saveSignedPreKey: Should not be called by libsignal!');
  }

  async getSignedPreKey(id: number): Promise<SignedPreKeyRecord> {
    const signedPreKey = await signalProtocolStore.loadSignedPreKey(
      this.#ourServiceId,
      id
    );

    if (!signedPreKey) {
      throw new Error(`getSignedPreKey: SignedPreKey ${id} not found`);
    }

    return signedPreKey;
  }
}
