// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  AccountEntropyPool,
  SvrKey,
} from '@signalapp/libsignal-client/dist/AccountKeys';

import { itemStorage } from '../textsecure/Storage.preload.ts';
import { toHex } from '../Bytes.std.ts';

export function getSvrKey(): SvrKey {
  const aep = itemStorage.get('accountEntropyPool');
  if (!aep) {
    throw new Error('missing aep!');
  }

  const svrKeyData = AccountEntropyPool.deriveSvrKey(aep);
  return new SvrKey(svrKeyData);
}

export function getRegistrationLockString(): string {
  const registrationLock = getSvrKey().deriveRegistrationLock();
  return toHex(registrationLock);
}
