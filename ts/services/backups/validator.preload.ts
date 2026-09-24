// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as libsignal from '@signalapp/libsignal-client/dist/MessageBackup.js';
import type { InputStream } from '@signalapp/libsignal-client/dist/io.js';

import { strictAssert } from '../../util/assert.std.ts';
import { toAciObject } from '../../util/ServiceId.node.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';
import { Backups } from '../../protobuf/index.std.ts';

export enum ValidationType {
  Export = 'Export',
  Internal = 'Internal',
}

export async function validateBackup(
  inputFactory: () => InputStream,
  fileSize: number,
  type: ValidationType
): Promise<void> {
  const accountEntropy = itemStorage.get('accountEntropyPool');
  strictAssert(accountEntropy, 'Account Entropy Pool not available');

  const aci = toAciObject(itemStorage.user.getCheckedAci());
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

  if (type === ValidationType.Internal) {
    strictAssert(
      outcome.ok,
      `Backup validation failed: ${outcome.errorMessage}`
    );
  } else if (type === ValidationType.Export) {
    strictAssert(
      outcome.ok,
      `Backup validation failed: ${outcome.errorMessage}`
    );
  } else {
    throw missingCaseError(type);
  }
}

export async function validateBackupIterator(
  info: Backups.BackupInfo.Params,
  iterable: AsyncIterable<NonNullable<Backups.Frame.Params['item']>>
): Promise<number> {
  const infoBuf = Backups.BackupInfo.encode(info);
  let totalBytes = infoBuf.byteLength;

  const validator = new libsignal.OnlineBackupValidator(
    infoBuf,
    libsignal.Purpose.RemoteBackup
  );

  const allErrorMessages: Array<string> = [];
  let frameCount = 0;
  for await (const item of iterable) {
    const frameBuf = Backups.Frame.encode({ item });

    try {
      totalBytes += frameBuf.byteLength;
      frameCount += 1;
      validator.addFrame(frameBuf);
    } catch (error) {
      allErrorMessages.push(error.message);
    }
  }

  try {
    validator.finalize();
  } catch (error) {
    allErrorMessages.push(error.message);
  }

  if (allErrorMessages.length) {
    throw new Error(allErrorMessages.join('\n'));
  }
  return totalBytes;
}
