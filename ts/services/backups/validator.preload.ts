// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as libsignal from '@signalapp/libsignal-client/dist/MessageBackup.js';
import type { InputStream } from '@signalapp/libsignal-client/dist/io.js';
import type { BackupKey } from '@signalapp/libsignal-client/dist/AccountKeys.js';

import { itemStorage } from '../../textsecure/Storage.preload.ts';
import { Backups } from '../../protobuf/index.std.ts';
import { getMessageBackupKey } from './crypto.preload.ts';

export async function validateBackup(
  inputFactory: () => InputStream,
  fileSize: number,
  purpose: libsignal.Purpose,
  backupKey: BackupKey
): Promise<void> {
  const outcome = await libsignal.validate(
    getMessageBackupKey(backupKey, itemStorage.user.getCheckedAci()),
    purpose,
    inputFactory,
    BigInt(fileSize)
  );

  if (!outcome.ok) {
    throw new Error(`Backup validation failed: ${outcome.errorMessage}`);
  }
}

export async function _internalValidateBackupIterator(
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
