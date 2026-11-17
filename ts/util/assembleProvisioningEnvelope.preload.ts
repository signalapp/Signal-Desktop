// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Bytes } from '@signalapp/types';
import type { PublicKey } from '@signalapp/libsignal-client';

import { strictAssert } from './assert.std.ts';
import { toAciObject, toPniObject } from './ServiceId.node.ts';
import { SignalService as Proto } from '../protobuf/index.std.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import { signalProtocolStore } from '../SignalProtocolStore.preload.ts';
import ProvisioningCipher from '../textsecure/ProvisioningCipher.node.ts';
import { toUntaggedPni } from '../types/ServiceId.std.ts';

export function assembleProvisioningEnvelope({
  ephemeralBackupKey,
  theirPublicKey,
  verificationCode: provisioningCode,
}: {
  ephemeralBackupKey: Uint8Array<ArrayBuffer> | undefined;
  theirPublicKey: PublicKey;
  verificationCode: string;
}): Bytes {
  const aci = itemStorage.user.getCheckedAci();
  const aciIdentityKey = signalProtocolStore.getIdentityKeyPair(aci);
  strictAssert(aciIdentityKey, 'Missing aciIdentityKey');

  const pni = itemStorage.user.getOptionalPni() ?? null;
  const untaggedPni = pni ? toUntaggedPni(pni) : null;
  const pniIdentityKey = pni
    ? signalProtocolStore.getIdentityKeyPair(pni)
    : null;

  const number = itemStorage.user.getOptionalNumber() ?? null;

  const profileKey = itemStorage.get('profileKey');
  strictAssert(profileKey, 'Missing profileKey');

  const readReceipts = itemStorage.get('read-receipt-setting') ?? null;

  const accountEntropyPool = itemStorage.get('accountEntropyPool');
  strictAssert(accountEntropyPool, 'Missing accountEntropyPool');

  const mediaRootBackupKey = itemStorage.get('backupMediaRootKey');

  const authCredentialSalt = itemStorage.get('authCredentialSalt') ?? null;

  const message: Proto.ProvisionMessage = {
    aciIdentityKeyPublic: aciIdentityKey.publicKey.serialize(),
    aciIdentityKeyPrivate: aciIdentityKey.privateKey.serialize(),
    pniIdentityKeyPublic: pniIdentityKey?.publicKey.serialize() ?? null,
    pniIdentityKeyPrivate: pniIdentityKey?.privateKey.serialize() ?? null,
    aci,
    pni: untaggedPni,
    number,
    provisioningCode,
    userAgent: 'OWD',
    profileKey: profileKey ?? null,
    readReceipts,
    provisioningVersion: 1,
    masterKey: null,
    ephemeralBackupKey: ephemeralBackupKey ?? null,
    accountEntropyPool,
    mediaRootBackupKey: mediaRootBackupKey ?? null,
    aciBinary: toAciObject(aci).getRawUuidBytes(),
    pniBinary: pni ? toPniObject(pni).getRawUuidBytes() : null,
    authCredentialSalt,
    $unknown: [],
  };
  const cipher = new ProvisioningCipher();
  const ourPublicKey = cipher.getPublicKey().serialize();
  const body = cipher.encrypt(message, theirPublicKey);

  const envelope: Proto.ProvisionEnvelope = {
    publicKey: ourPublicKey,
    body,
    $unknown: [],
  };
  return Proto.ProvisionEnvelope.encode(envelope);
}
