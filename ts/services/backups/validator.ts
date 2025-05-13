// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Readable } from 'node:stream';
import { once } from 'node:events';
import * as libsignal from '@signalapp/libsignal-client/dist/MessageBackup';
import type { InputStream } from '@signalapp/libsignal-client/dist/io';
import { Reader } from 'protobufjs';

import { strictAssert } from '../../util/assert';
import { toAciObject } from '../../util/ServiceId';
import { missingCaseError } from '../../util/missingCaseError';

export enum ValidationType {
  Export = 'Export',
  Internal = 'Internal',
}

export async function validateBackup(
  inputFactory: () => InputStream,
  fileSize: number,
  type: ValidationType
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

  if (type === ValidationType.Internal) {
    strictAssert(
      outcome.ok,
      `Backup validation failed: ${outcome.errorMessage}`
    );
  } else if (type === ValidationType.Export) {
    strictAssert(outcome.ok, 'Backup validation failed');
  } else {
    throw missingCaseError(type);
  }
}

export async function validateBackupStream(
  readable: Readable
): Promise<number> {
  let validator: libsignal.OnlineBackupValidator | undefined;

  let totalBytes = 0;
  let frameCount = 0;
  readable.on('data', delimitedFrame => {
    totalBytes += delimitedFrame.byteLength;
    frameCount += 1;

    const reader = new Reader(delimitedFrame);
    const frame = Buffer.from(reader.bytes());

    // Info frame
    if (frameCount === 1) {
      validator = new libsignal.OnlineBackupValidator(
        frame,
        libsignal.Purpose.RemoteBackup
      );
      return;
    }

    strictAssert(validator != null, 'validator must be already created');
    validator.addFrame(frame);
  });

  await once(readable, 'end');
  strictAssert(validator != null, 'no frames');
  validator.finalize();

  return totalBytes;
}
