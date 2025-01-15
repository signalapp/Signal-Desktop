// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import { isNumber } from 'lodash';

import type {
  Direction,
  KyberPreKeyRecord,
  PreKeyRecord,
  ProtocolAddress,
  SenderKeyRecord,
  SessionRecord,
  SignedPreKeyRecord,
  Uuid,
} from '@signalapp/libsignal-client';
import {
  IdentityKeyStore,
  KyberPreKeyStore,
  PreKeyStore,
  PrivateKey,
  PublicKey,
  SenderKeyStore,
  SessionStore,
  SignedPreKeyStore,
} from '@signalapp/libsignal-client';
import { Address } from './types/Address';
import { QualifiedAddress } from './types/QualifiedAddress';
import type { ServiceIdString } from './types/ServiceId';
import { normalizeServiceId } from './types/ServiceId';

import type { Zone } from './util/Zone';

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
    await window.textsecure.storage.protocol.storeSession(
      toQualifiedAddress(this.#ourServiceId, address),
      record,
      { zone: this.#zone }
    );
  }

  async getSession(name: ProtocolAddress): Promise<SessionRecord | null> {
    const encodedAddress = toQualifiedAddress(this.#ourServiceId, name);
    const record = await window.textsecure.storage.protocol.loadSession(
      encodedAddress,
      { zone: this.#zone }
    );

    return record || null;
  }

  async getExistingSessions(
    addresses: Array<ProtocolAddress>
  ): Promise<Array<SessionRecord>> {
    const encodedAddresses = addresses.map(addr =>
      toQualifiedAddress(this.#ourServiceId, addr)
    );
    return window.textsecure.storage.protocol.loadSessions(encodedAddresses, {
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
    const keyPair = window.textsecure.storage.protocol.getIdentityKeyPair(
      this.#ourServiceId
    );
    if (!keyPair) {
      throw new Error('IdentityKeyStore/getIdentityKey: No identity key!');
    }
    return PrivateKey.deserialize(Buffer.from(keyPair.privKey));
  }

  async getLocalRegistrationId(): Promise<number> {
    const id = await window.textsecure.storage.protocol.getLocalRegistrationId(
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
    const key = await window.textsecure.storage.protocol.loadIdentityKey(
      encodedAddress.serviceId
    );

    if (!key) {
      return null;
    }

    return PublicKey.deserialize(Buffer.from(key));
  }

  async saveIdentity(name: ProtocolAddress, key: PublicKey): Promise<boolean> {
    const encodedAddress = encodeAddress(name);
    const publicKey = key.serialize();

    // Pass `zone` to let `saveIdentity` archive sibling sessions when identity
    // key changes.
    return window.textsecure.storage.protocol.saveIdentity(
      encodedAddress,
      publicKey,
      false,
      { zone: this.#zone }
    );
  }

  async isTrustedIdentity(
    name: ProtocolAddress,
    key: PublicKey,
    direction: Direction
  ): Promise<boolean> {
    const encodedAddress = encodeAddress(name);
    const publicKey = key.serialize();

    return window.textsecure.storage.protocol.isTrustedIdentity(
      encodedAddress,
      publicKey,
      direction
    );
  }
}

export type PreKeysOptions = Readonly<{
  ourServiceId: ServiceIdString;
}>;

export class PreKeys extends PreKeyStore {
  readonly #ourServiceId: ServiceIdString;

  constructor({ ourServiceId }: PreKeysOptions) {
    super();
    this.#ourServiceId = ourServiceId;
  }

  async savePreKey(): Promise<void> {
    throw new Error('savePreKey: Should not be called by libsignal!');
  }

  async getPreKey(id: number): Promise<PreKeyRecord> {
    const preKey = await window.textsecure.storage.protocol.loadPreKey(
      this.#ourServiceId,
      id
    );

    if (preKey === undefined) {
      throw new Error(`getPreKey: PreKey ${id} not found`);
    }

    return preKey;
  }

  async removePreKey(id: number): Promise<void> {
    await window.textsecure.storage.protocol.removePreKeys(this.#ourServiceId, [
      id,
    ]);
  }
}

export class KyberPreKeys extends KyberPreKeyStore {
  readonly #ourServiceId: ServiceIdString;

  constructor({ ourServiceId }: PreKeysOptions) {
    super();
    this.#ourServiceId = ourServiceId;
  }

  async saveKyberPreKey(): Promise<void> {
    throw new Error('saveKyberPreKey: Should not be called by libsignal!');
  }

  async getKyberPreKey(id: number): Promise<KyberPreKeyRecord> {
    const kyberPreKey =
      await window.textsecure.storage.protocol.loadKyberPreKey(
        this.#ourServiceId,
        id
      );

    if (kyberPreKey === undefined) {
      throw new Error(`getKyberPreKey: KyberPreKey ${id} not found`);
    }

    return kyberPreKey;
  }

  async markKyberPreKeyUsed(id: number): Promise<void> {
    await window.textsecure.storage.protocol.maybeRemoveKyberPreKey(
      this.#ourServiceId,
      id
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

    await window.textsecure.storage.protocol.saveSenderKey(
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

    const senderKey = await window.textsecure.storage.protocol.getSenderKey(
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
    const signedPreKey =
      await window.textsecure.storage.protocol.loadSignedPreKey(
        this.#ourServiceId,
        id
      );

    if (!signedPreKey) {
      throw new Error(`getSignedPreKey: SignedPreKey ${id} not found`);
    }

    return signedPreKey;
  }
}
