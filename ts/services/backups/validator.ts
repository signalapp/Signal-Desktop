// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type FileHandle, open } from 'node:fs/promises';
import * as libsignal from '@signalapp/libsignal-client/dist/MessageBackup';
import { InputStream } from '@signalapp/libsignal-client/dist/io';

import { strictAssert } from '../../util/assert';
import { toAciObject } from '../../util/ServiceId';
import { isTestOrMockEnvironment } from '../../environment';

class FileStream extends InputStream {
  private file: FileHandle | undefined;
  private position = 0;
  private buffer = Buffer.alloc(16 * 1024);
  private initPromise: Promise<unknown> | undefined;

  constructor(private readonly filePath: string) {
    super();
  }

  public async close(): Promise<void> {
    await this.initPromise;
    await this.file?.close();
  }

  async read(amount: number): Promise<Buffer> {
    await this.initPromise;

    if (!this.file) {
      const filePromise = open(this.filePath);
      this.initPromise = filePromise;
      this.file = await filePromise;
    }

    if (this.buffer.length < amount) {
      this.buffer = Buffer.alloc(amount);
    }
    const { bytesRead } = await this.file.read(
      this.buffer,
      0,
      amount,
      this.position
    );
    this.position += bytesRead;
    return this.buffer.slice(0, bytesRead);
  }

  async skip(amount: number): Promise<void> {
    this.position += amount;
  }
}

export async function validateBackup(
  filePath: string,
  fileSize: number
): Promise<void> {
  const masterKeyBase64 = window.storage.get('masterKey');
  strictAssert(masterKeyBase64, 'Master key not available');

  const masterKey = Buffer.from(masterKeyBase64, 'base64');

  const aci = toAciObject(window.storage.user.getCheckedAci());
  const backupKey = new libsignal.MessageBackupKey(masterKey, aci);

  const streams = new Array<FileStream>();

  let outcome: libsignal.ValidationOutcome;
  try {
    outcome = await libsignal.validate(
      backupKey,
      libsignal.Purpose.RemoteBackup,
      () => {
        const stream = new FileStream(filePath);
        streams.push(stream);
        return stream;
      },
      BigInt(fileSize)
    );
  } finally {
    await Promise.all(streams.map(stream => stream.close()));
  }

  if (isTestOrMockEnvironment()) {
    strictAssert(
      outcome.ok,
      `Backup validation failed: ${outcome.errorMessage}`
    );
  } else {
    strictAssert(outcome.ok, 'Backup validation failed');
  }
}
