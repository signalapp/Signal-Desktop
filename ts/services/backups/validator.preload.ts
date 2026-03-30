// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type Readable, PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as libsignal from '@signalapp/libsignal-client/dist/MessageBackup.js';
import type { InputStream } from '@signalapp/libsignal-client/dist/io.js';

import { strictAssert } from '../../util/assert.std.ts';
import { toAciObject } from '../../util/ServiceId.node.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { DelimitedStream } from '../../util/DelimitedStream.node.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';

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

export async function validateBackupStream(
  readable: Readable
): Promise<number> {
  let validator: libsignal.OnlineBackupValidator | undefined;

  let totalBytes = 0;
  let frameCount = 0;
  const allErrorMessages: Array<string> = [];

  const countBytes = new PassThrough();
  countBytes.on('data', bytes => {
    totalBytes += bytes.byteLength;
  });

  const delimited = new DelimitedStream();
  delimited.on('data', frame => {
    frameCount += 1;

    // Info frame
    if (frameCount === 1) {
      validator = new libsignal.OnlineBackupValidator(
        frame,
        libsignal.Purpose.RemoteBackup
      );
      return;
    }

    strictAssert(validator != null, 'validator must be already created');
    try {
      validator.addFrame(frame);
    } catch (error) {
      allErrorMessages.push(error.message);
    }
  });

  await pipeline(readable, countBytes, delimited);

  strictAssert(validator != null, 'no frames');

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
