// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import memoizee from 'memoizee';

import { strictAssert } from '../../util/assert';
import type { AciString } from '../../types/ServiceId';
import { toAciObject } from '../../util/ServiceId';
import {
  deriveBackupKey,
  deriveBackupSignatureKey,
  deriveBackupId,
  deriveBackupKeyMaterial,
} from '../../Crypto';
import type { BackupKeyMaterialType } from '../../Crypto';

const getMemoizedBackupKey = memoizee((masterKey: string) => {
  return deriveBackupKey(Buffer.from(masterKey, 'base64'));
});

export function getBackupKey(): Uint8Array {
  const masterKey = window.storage.get('masterKey');
  strictAssert(masterKey, 'Master key not available');

  return getMemoizedBackupKey(masterKey);
}

const getMemoizedBackupSignatureKey = memoizee(
  (backupKey: Uint8Array, aci: AciString) => {
    const aciBytes = toAciObject(aci).getServiceIdBinary();
    return deriveBackupSignatureKey(backupKey, aciBytes);
  }
);

export function getBackupSignatureKey(): Uint8Array {
  const backupKey = getBackupKey();
  const aci = window.storage.user.getCheckedAci();
  return getMemoizedBackupSignatureKey(backupKey, aci);
}

const getMemoizedKeyMaterial = memoizee(
  (backupKey: Uint8Array, aci: AciString) => {
    const aciBytes = toAciObject(aci).getServiceIdBinary();
    const backupId = deriveBackupId(backupKey, aciBytes);
    return deriveBackupKeyMaterial(backupKey, backupId);
  }
);

export function getKeyMaterial(): BackupKeyMaterialType {
  const backupKey = getBackupKey();
  const aci = window.storage.user.getCheckedAci();
  return getMemoizedKeyMaterial(backupKey, aci);
}
