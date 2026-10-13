// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  AccountEntropyPool,
  SvrKey,
} from '@signalapp/libsignal-client/dist/AccountKeys';

import { itemStorage } from '../textsecure/Storage.preload.ts';

export function getRecoveryPassword(
  providedAep?: string
): Uint8Array<ArrayBuffer> {
  const aep = providedAep ?? itemStorage.get('accountEntropyPool');
  if (!aep) {
    throw new Error('missing aep!');
  }

  const svrKeyData = AccountEntropyPool.deriveSvrKey(aep);
  const svrKey = new SvrKey(svrKeyData);

  return svrKey.deriveRegistrationRecoveryPassword();
}
