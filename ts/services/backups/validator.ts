// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as libsignal from '@signalapp/libsignal-client/dist/MessageBackup';
import type { InputStream } from '@signalapp/libsignal-client/dist/io';

import { strictAssert } from '../../util/assert';
import { toAciObject } from '../../util/ServiceId';
import { isTestOrMockEnvironment } from '../../environment';

export async function validateBackup(
  inputFactory: () => InputStream,
  fileSize: number
): Promise<void> {
  const accountEntropy = window.storage.get('accountEntropyPool');
  strictAssert(accountEntropy, 'Account Entropy Pool not available');

  const aci = toAciObject(window.storage.user.getCheckedAci());
  const backupKey = new libsignal.MessageBackupKey({
    accountEntropy,
    aci,
  });

  const outcome = await libsignal.validate(
    backupKey,
    libsignal.Purpose.RemoteBackup,
    inputFactory,
    BigInt(fileSize)
  );

  if (isTestOrMockEnvironment()) {
    strictAssert(
      outcome.ok,
      `Backup validation failed: ${outcome.errorMessage}`
    );
  } else {
    strictAssert(outcome.ok, 'Backup validation failed');
  }
}
