// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import memoizee from 'memoizee';
import type { PrivateKey } from '@signalapp/libsignal-client';
import {
  AccountEntropyPool,
  BackupKey,
} from '@signalapp/libsignal-client/dist/AccountKeys.js';
import { MessageBackupKey } from '@signalapp/libsignal-client/dist/MessageBackup.js';

import { strictAssert } from '../../util/assert.std.js';
import type { AciString } from '../../types/ServiceId.std.js';
import { toAciObject } from '../../util/ServiceId.node.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

const getMemoizedBackupKey = memoizee((accountEntropyPool: string) => {
  return AccountEntropyPool.deriveBackupKey(accountEntropyPool);
});

export function getBackupKey(): BackupKey {
  const accountEntropyPool = itemStorage.get('accountEntropyPool');
  strictAssert(accountEntropyPool, 'Account Entropy Pool not available');

  return getMemoizedBackupKey(accountEntropyPool);
}

export function getBackupMediaRootKey(): BackupKey {
  const rootKey = itemStorage.get('backupMediaRootKey');
  strictAssert(rootKey, 'Media root key not available');

  return new BackupKey(rootKey);
}

const getMemoizedBackupSignatureKey = memoizee(
  (backupKey: BackupKey, aci: AciString) => {
    return backupKey.deriveEcKey(toAciObject(aci));
  }
);

export function getBackupSignatureKey(): PrivateKey {
  const backupKey = getBackupKey();
  const aci = itemStorage.user.getCheckedAci();
  return getMemoizedBackupSignatureKey(backupKey, aci);
}

const getMemoizedBackupMediaSignatureKey = memoizee(
  (rootKey: BackupKey, aci: AciString) => {
    return rootKey.deriveEcKey(toAciObject(aci));
  }
);

export function getBackupMediaSignatureKey(): PrivateKey {
  const rootKey = getBackupMediaRootKey();
  const aci = itemStorage.user.getCheckedAci();
  return getMemoizedBackupMediaSignatureKey(rootKey, aci);
}

const getMemoizedKeyMaterial = memoizee(
  (backupKey: BackupKey, aci: AciString) => {
    const messageKey = new MessageBackupKey({
      backupKey,
      backupId: backupKey.deriveBackupId(toAciObject(aci)),
    });

    return { macKey: messageKey.hmacKey, aesKey: messageKey.aesKey };
  }
);

export type BackupKeyMaterialType = Readonly<{
  macKey: Uint8Array;
  aesKey: Uint8Array;
}>;

export function getKeyMaterial(
  backupKey = getBackupKey()
): BackupKeyMaterialType {
  const aci = itemStorage.user.getCheckedAci();
  return getMemoizedKeyMaterial(backupKey, aci);
}

export type BackupMediaKeyMaterialType = Readonly<{
  macKey: Uint8Array;
  aesKey: Uint8Array;
}>;

const BACKUP_MEDIA_AES_KEY_LEN = 32;
const BACKUP_MEDIA_MAC_KEY_LEN = 32;

export function deriveBackupMediaKeyMaterial(
  mediaRootKey: BackupKey,
  mediaId: Uint8Array
): BackupMediaKeyMaterialType {
  if (!mediaId.length) {
    throw new Error('deriveBackupMediaKeyMaterial: mediaId missing');
  }

  const material = mediaRootKey.deriveMediaEncryptionKey(mediaId);

  return {
    macKey: material.subarray(0, BACKUP_MEDIA_MAC_KEY_LEN),
    aesKey: material.subarray(
      BACKUP_MEDIA_MAC_KEY_LEN,
      BACKUP_MEDIA_MAC_KEY_LEN + BACKUP_MEDIA_AES_KEY_LEN
    ),
  };
}

export function deriveBackupThumbnailTransitKeyMaterial(
  mediaRootKey: BackupKey,
  mediaId: Uint8Array
): BackupMediaKeyMaterialType {
  if (!mediaId.length) {
    throw new Error('deriveBackupThumbnailTransitKeyMaterial: mediaId missing');
  }

  const material = mediaRootKey.deriveThumbnailTransitEncryptionKey(mediaId);

  return {
    macKey: material.subarray(0, BACKUP_MEDIA_MAC_KEY_LEN),
    aesKey: material.subarray(
      BACKUP_MEDIA_MAC_KEY_LEN,
      BACKUP_MEDIA_MAC_KEY_LEN + BACKUP_MEDIA_AES_KEY_LEN
    ),
  };
}

export function getBackupId(): Uint8Array {
  const aci = itemStorage.user.getCheckedAci();
  return getBackupKey().deriveBackupId(toAciObject(aci));
}

export function getLocalBackupMetadataKey(): Uint8Array {
  return getBackupKey().deriveLocalBackupMetadataKey();
}
