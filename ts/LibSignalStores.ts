// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import { isNumber } from 'lodash';

import type {
  Direction,
  PreKeyRecord,
  ProtocolAddress,
  SenderKeyRecord,
  SessionRecord,
  SignedPreKeyRecord,
  Uuid,
} from '@signalapp/libsignal-client';
import {
  IdentityKeyStore,
  PreKeyStore,
  PrivateKey,
  PublicKey,
  SenderKeyStore,
  SessionStore,
  SignedPreKeyStore,
} from '@signalapp/libsignal-client';
import { freezePreKey, freezeSignedPreKey } from './SignalProtocolStore';
import { Address } from './types/Address';
import { QualifiedAddress } from './types/QualifiedAddress';
import type { UUID } from './types/UUID';

import type { Zone } from './util/Zone';

function encodeAddress(address: ProtocolAddress): Address {
  const name = address.name();
  const deviceId = address.deviceId();
  return Address.create(name, deviceId);
}

function toQualifiedAddress(
  ourUuid: UUID,
  address: ProtocolAddress
): QualifiedAddress {
  return new QualifiedAddress(ourUuid, encodeAddress(address));
}

export type SessionsOptions = Readonly<{
  ourUuid: UUID;
  zone?: Zone;
}>;

export class Sessions extends SessionStore {
  private readonly ourUuid: UUID;

  private readonly zone: Zone | undefined;

  constructor({ ourUuid, zone }: SessionsOptions) {
    super();

    this.ourUuid = ourUuid;
    this.zone = zone;
  }

  async saveSession(
    address: ProtocolAddress,
    record: SessionRecord
  ): Promise<void> {
    await window.textsecure.storage.protocol.storeSession(
      toQualifiedAddress(this.ourUuid, address),
      record,
      { zone: this.zone }
    );
  }

  async getSession(name: ProtocolAddress): Promise<SessionRecord | null> {
    const encodedAddress = toQualifiedAddress(this.ourUuid, name);
    const record = await window.textsecure.storage.protocol.loadSession(
      encodedAddress,
      { zone: this.zone }
    );

    return record || null;
  }

  async getExistingSessions(
    addresses: Array<ProtocolAddress>
  ): Promise<Array<SessionRecord>> {
    const encodedAddresses = addresses.map(addr =>
      toQualifiedAddress(this.ourUuid, addr)
    );
    return window.textsecure.storage.protocol.loadSessions(encodedAddresses, {
      zone: this.zone,
    });
  }
}

export type IdentityKeysOptions = Readonly<{
  ourUuid: UUID;
  zone?: Zone;
}>;

export class IdentityKeys extends IdentityKeyStore {
  private readonly ourUuid: UUID;

  private readonly zone: Zone | undefined;

  constructor({ ourUuid, zone }: IdentityKeysOptions) {
    super();

    this.ourUuid = ourUuid;
    this.zone = zone;
  }

  async getIdentityKey(): Promise<PrivateKey> {
    const keyPair = await window.textsecure.storage.protocol.getIdentityKeyPair(
      this.ourUuid
    );
    if (!keyPair) {
      throw new Error('IdentityKeyStore/getIdentityKey: No identity key!');
    }
    return PrivateKey.deserialize(Buffer.from(keyPair.privKey));
  }

  async getLocalRegistrationId(): Promise<number> {
    const id = await window.textsecure.storage.protocol.getLocalRegistrationId(
      this.ourUuid
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
      encodedAddress.uuid
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
      { zone: this.zone }
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
  ourUuid: UUID;
}>;

export class PreKeys extends PreKeyStore {
  private readonly ourUuid: UUID;

  constructor({ ourUuid }: PreKeysOptions) {
    super();
    this.ourUuid = ourUuid;
  }

  async savePreKey(id: number, record: PreKeyRecord): Promise<void> {
    await window.textsecure.storage.protocol.storePreKey(
      this.ourUuid,
      id,
      freezePreKey(record)
    );
  }

  async getPreKey(id: number): Promise<PreKeyRecord> {
    const preKey = await window.textsecure.storage.protocol.loadPreKey(
      this.ourUuid,
      id
    );

    if (preKey === undefined) {
      throw new Error(`getPreKey: PreKey ${id} not found`);
    }

    return preKey;
  }

  async removePreKey(id: number): Promise<void> {
    await window.textsecure.storage.protocol.removePreKey(this.ourUuid, id);
  }
}

export type SenderKeysOptions = Readonly<{
  readonly ourUuid: UUID;
  readonly zone: Zone | undefined;
}>;

export class SenderKeys extends SenderKeyStore {
  private readonly ourUuid: UUID;

  readonly zone: Zone | undefined;

  constructor({ ourUuid, zone }: SenderKeysOptions) {
    super();
    this.ourUuid = ourUuid;
    this.zone = zone;
  }

  async saveSenderKey(
    sender: ProtocolAddress,
    distributionId: Uuid,
    record: SenderKeyRecord
  ): Promise<void> {
    const encodedAddress = toQualifiedAddress(this.ourUuid, sender);

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
    const encodedAddress = toQualifiedAddress(this.ourUuid, sender);

    const senderKey = await window.textsecure.storage.protocol.getSenderKey(
      encodedAddress,
      distributionId,
      { zone: this.zone }
    );

    return senderKey || null;
  }
}

export type SignedPreKeysOptions = Readonly<{
  ourUuid: UUID;
}>;

export class SignedPreKeys extends SignedPreKeyStore {
  private readonly ourUuid: UUID;

  constructor({ ourUuid }: SignedPreKeysOptions) {
    super();
    this.ourUuid = ourUuid;
  }

  async saveSignedPreKey(
    id: number,
    record: SignedPreKeyRecord
  ): Promise<void> {
    await window.textsecure.storage.protocol.storeSignedPreKey(
      this.ourUuid,
      id,
      freezeSignedPreKey(record),
      true
    );
  }

  async getSignedPreKey(id: number): Promise<SignedPreKeyRecord> {
    const signedPreKey =
      await window.textsecure.storage.protocol.loadSignedPreKey(
        this.ourUuid,
        id
      );

    if (!signedPreKey) {
      throw new Error(`getSignedPreKey: SignedPreKey ${id} not found`);
    }

    return signedPreKey;
  }
}
