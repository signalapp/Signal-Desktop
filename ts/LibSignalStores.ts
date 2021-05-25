// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */
/* eslint-disable class-methods-use-this */

import { isNumber } from 'lodash';

import {
  Direction,
  IdentityKeyStore,
  PreKeyRecord,
  PreKeyStore,
  PrivateKey,
  ProtocolAddress,
  PublicKey,
  SenderKeyRecord,
  SenderKeyStore,
  SessionRecord,
  SessionStore,
  SignedPreKeyRecord,
  SignedPreKeyStore,
  Uuid,
} from '@signalapp/signal-client';
import { freezePreKey, freezeSignedPreKey } from './SignalProtocolStore';

import { typedArrayToArrayBuffer } from './Crypto';

import { Zone } from './util/Zone';

function encodedNameFromAddress(address: ProtocolAddress): string {
  const name = address.name();
  const deviceId = address.deviceId();
  const encodedName = `${name}.${deviceId}`;
  return encodedName;
}

export type SessionsOptions = {
  readonly zone?: Zone;
};

export class Sessions extends SessionStore {
  private readonly zone: Zone | undefined;

  constructor(options: SessionsOptions = {}) {
    super();
    this.zone = options.zone;
  }

  async saveSession(
    address: ProtocolAddress,
    record: SessionRecord
  ): Promise<void> {
    await window.textsecure.storage.protocol.storeSession(
      encodedNameFromAddress(address),
      record,
      { zone: this.zone }
    );
  }

  async getSession(name: ProtocolAddress): Promise<SessionRecord | null> {
    const encodedName = encodedNameFromAddress(name);
    const record = await window.textsecure.storage.protocol.loadSession(
      encodedName,
      { zone: this.zone }
    );

    return record || null;
  }

  async getExistingSessions(
    addresses: Array<ProtocolAddress>
  ): Promise<Array<SessionRecord>> {
    const encodedAddresses = addresses.map(encodedNameFromAddress);
    return window.textsecure.storage.protocol.loadSessions(encodedAddresses, {
      zone: this.zone,
    });
  }
}

export type IdentityKeysOptions = {
  readonly zone?: Zone;
};

export class IdentityKeys extends IdentityKeyStore {
  private readonly zone: Zone | undefined;

  constructor({ zone }: IdentityKeysOptions = {}) {
    super();
    this.zone = zone;
  }

  async getIdentityKey(): Promise<PrivateKey> {
    const keyPair = await window.textsecure.storage.protocol.getIdentityKeyPair();
    if (!keyPair) {
      throw new Error('IdentityKeyStore/getIdentityKey: No identity key!');
    }
    return PrivateKey.deserialize(Buffer.from(keyPair.privKey));
  }

  async getLocalRegistrationId(): Promise<number> {
    const id = await window.textsecure.storage.protocol.getLocalRegistrationId();
    if (!isNumber(id)) {
      throw new Error(
        'IdentityKeyStore/getLocalRegistrationId: No registration id!'
      );
    }
    return id;
  }

  async getIdentity(address: ProtocolAddress): Promise<PublicKey | null> {
    const encodedName = encodedNameFromAddress(address);
    const key = await window.textsecure.storage.protocol.loadIdentityKey(
      encodedName
    );

    if (!key) {
      return null;
    }

    return PublicKey.deserialize(Buffer.from(key));
  }

  async saveIdentity(name: ProtocolAddress, key: PublicKey): Promise<boolean> {
    const encodedName = encodedNameFromAddress(name);
    const publicKey = typedArrayToArrayBuffer(key.serialize());

    // Pass `zone` to let `saveIdentity` archive sibling sessions when identity
    // key changes.
    return window.textsecure.storage.protocol.saveIdentity(
      encodedName,
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
    const encodedName = encodedNameFromAddress(name);
    const publicKey = typedArrayToArrayBuffer(key.serialize());

    return window.textsecure.storage.protocol.isTrustedIdentity(
      encodedName,
      publicKey,
      direction
    );
  }
}

export class PreKeys extends PreKeyStore {
  async savePreKey(id: number, record: PreKeyRecord): Promise<void> {
    await window.textsecure.storage.protocol.storePreKey(
      id,
      freezePreKey(record)
    );
  }

  async getPreKey(id: number): Promise<PreKeyRecord> {
    const preKey = await window.textsecure.storage.protocol.loadPreKey(id);

    if (preKey === undefined) {
      throw new Error(`getPreKey: PreKey ${id} not found`);
    }

    return preKey;
  }

  async removePreKey(id: number): Promise<void> {
    await window.textsecure.storage.protocol.removePreKey(id);
  }
}

export class SenderKeys extends SenderKeyStore {
  async saveSenderKey(
    sender: ProtocolAddress,
    distributionId: Uuid,
    record: SenderKeyRecord
  ): Promise<void> {
    const encodedAddress = encodedNameFromAddress(sender);

    await window.textsecure.storage.protocol.saveSenderKey(
      encodedAddress,
      distributionId,
      record
    );
  }

  async getSenderKey(
    sender: ProtocolAddress,
    distributionId: Uuid
  ): Promise<SenderKeyRecord | null> {
    const encodedAddress = encodedNameFromAddress(sender);

    const senderKey = await window.textsecure.storage.protocol.getSenderKey(
      encodedAddress,
      distributionId
    );

    return senderKey || null;
  }
}

export class SignedPreKeys extends SignedPreKeyStore {
  async saveSignedPreKey(
    id: number,
    record: SignedPreKeyRecord
  ): Promise<void> {
    await window.textsecure.storage.protocol.storeSignedPreKey(
      id,
      freezeSignedPreKey(record),
      true
    );
  }

  async getSignedPreKey(id: number): Promise<SignedPreKeyRecord> {
    const signedPreKey = await window.textsecure.storage.protocol.loadSignedPreKey(
      id
    );

    if (!signedPreKey) {
      throw new Error(`getSignedPreKey: SignedPreKey ${id} not found`);
    }

    return signedPreKey;
  }
}
