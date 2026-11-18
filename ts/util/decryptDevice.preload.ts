// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LinkedDevice as LibsignalLinkedDevice } from '@signalapp/libsignal-client/dist/net.js';
import { PublicKey } from '@signalapp/libsignal-client';
import { Bytes } from '@signalapp/types';

import { createLogger } from '../logging/log.std.ts';
import { fromBase64 } from '../Bytes.std.ts';
import { SignalService as Proto } from '../protobuf/index.std.ts';
import {
  decryptDeviceName as baseDecryptDeviceName,
  encryptDeviceName as baseEncryptDeviceName,
  decryptDeviceCreatedAt as baseDecryptDeviceCreatedAt,
  encryptDeviceCreatedAt as baseEncryptDeviceCreatedAt,
} from '../Crypto.node.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import { signalProtocolStore } from '../SignalProtocolStore.preload.ts';
import { strictAssert } from './assert.std.ts';

import type { ServerDevice } from '../textsecure/WebAPI.preload.ts';
import type { KeyPairType } from '../textsecure/Types.d.ts';
import type { LinkedDevice } from '../sql/Interface.std.ts';

const log = createLogger('device');

export async function decryptDevice(
  device: LibsignalLinkedDevice
): Promise<LinkedDevice> {
  const logId = `decryptDevice/${device.id}`;
  let name: string | null = null;
  let createdAt: number | null = null;

  try {
    name = await decryptDeviceName(device.encryptedName);
  } catch (e) {
    log.error(`${logId}: failed to decrypt device name, returning null `);
  }
  try {
    createdAt = await decryptDeviceCreatedAt(
      device.createdAtCiphertext,
      device.registrationId,
      device.id
    );
  } catch (e) {
    log.error(`${logId}: failed to decrypt device createdAt, returning null`);
  }

  return {
    id: device.id,
    registrationId: device.registrationId,
    lastSeenAt: device.lastSeen,
    name,
    createdAt,
  };
}

export function decryptServerDevice(
  serverDevice: ServerDevice
): Promise<LinkedDevice> {
  const device: LibsignalLinkedDevice = {
    id: serverDevice.id,
    encryptedName: Bytes.fromMaybeSharedBytes(fromBase64(serverDevice.name)),
    lastSeen: serverDevice.lastSeen,
    registrationId: serverDevice.registrationId,
    createdAtCiphertext: Bytes.fromMaybeSharedBytes(
      fromBase64(serverDevice.createdAtCiphertext)
    ),
  };

  return decryptDevice(device);
}

export function encryptDeviceName(
  name: string,
  identityKey: KeyPairType
): Bytes | undefined {
  if (!name) {
    return undefined;
  }
  const encrypted = baseEncryptDeviceName(name, identityKey.publicKey);

  return Proto.DeviceName.encode({
    ephemeralPublic: encrypted.ephemeralPublic.serialize(),
    syntheticIv: encrypted.syntheticIv,
    ciphertext: encrypted.ciphertext,
  });
}

export async function decryptDeviceName(bytes: Bytes): Promise<string> {
  const ourAci = itemStorage.user.getCheckedAci();
  const identityKey = signalProtocolStore.getIdentityKeyPair(ourAci);
  if (!identityKey) {
    throw new Error('decryptDeviceName: No identity key pair!');
  }

  const proto = Proto.DeviceName.decode(bytes);
  strictAssert(
    proto.ephemeralPublic,
    'Missing ephemeralPublic field in DeviceName'
  );
  strictAssert(proto.syntheticIv, 'Missing syntheticIv field in DeviceName');
  strictAssert(proto.ciphertext, 'Missing ciphertext field in DeviceName');

  const name = baseDecryptDeviceName(
    {
      ephemeralPublic: PublicKey.deserialize(proto.ephemeralPublic),
      syntheticIv: proto.syntheticIv,
      ciphertext: proto.ciphertext,
    },
    identityKey.privateKey
  );

  return name;
}

export async function decryptDeviceCreatedAt(
  createdAtCiphertext: Bytes,
  registrationId: number,
  deviceId: number
): Promise<number> {
  const ourAci = itemStorage.user.getCheckedAci();
  const identityKey = signalProtocolStore.getIdentityKeyPair(ourAci);
  if (!identityKey) {
    throw new Error('decryptDeviceCreatedAt: No identity key pair!');
  }

  const createdAt = baseDecryptDeviceCreatedAt(
    createdAtCiphertext,
    deviceId,
    registrationId,
    identityKey.privateKey
  );

  return createdAt;
}

/** @testexport */
export async function _encryptDeviceCreatedAt(
  createdAt: number,
  deviceId: number
): Promise<Bytes> {
  const ourAci = itemStorage.user.getCheckedAci();
  const identityKey = signalProtocolStore.getIdentityKeyPair(ourAci);
  const registrationId =
    await signalProtocolStore.getLocalRegistrationId(ourAci);
  strictAssert(identityKey, 'Missing identity key pair');
  strictAssert(registrationId, 'Missing registrationId for our Aci');

  return baseEncryptDeviceCreatedAt(
    createdAt,
    deviceId,
    registrationId,
    identityKey.publicKey
  );
}
