// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { createWriteStream } from 'fs';

import * as log from '../../logging/log';
import * as Bytes from '../../Bytes';
import { DelimitedStream } from '../../util/DelimitedStream';
import * as Errors from '../../types/errors';
import { BackupExportStream } from './export';
import { BackupImportStream } from './import';

export class BackupsService {
  private isRunning = false;

  public exportBackup(): Readable {
    if (this.isRunning) {
      throw new Error('BackupService is already running');
    }

    log.info('exportBackup: starting...');
    this.isRunning = true;

    const stream = new BackupExportStream();
    const cleanup = () => {
      // Don't fire twice
      stream.removeListener('end', cleanup);
      stream.removeListener('error', cleanup);

      log.info('exportBackup: finished...');
      this.isRunning = false;
    };

    stream.once('end', cleanup);
    stream.once('error', cleanup);

    stream.run();

    return stream;
  }

  // Test harness
  public async exportBackupData(): Promise<Uint8Array> {
    const chunks = new Array<Uint8Array>();
    for await (const chunk of this.exportBackup()) {
      chunks.push(chunk);
    }

    return Bytes.concatenate(chunks);
  }

  // Test harness
  public async exportToDisk(path: string): Promise<void> {
    await pipeline(this.exportBackup(), createWriteStream(path));
  }

  // Test harness
  public async exportWithDialog(): Promise<void> {
    const data = await this.exportBackupData();

    const { saveAttachmentToDisk } = window.Signal.Migrations;

    await saveAttachmentToDisk({
      name: 'backup.bin',
      data,
    });
  }

  public async importBackup(backup: Uint8Array): Promise<void> {
    if (this.isRunning) {
      throw new Error('BackupService is already running');
    }

    log.info('importBackup: starting...');
    this.isRunning = true;

    try {
      await pipeline(
        Readable.from(backup),
        new DelimitedStream(),
        new BackupImportStream()
      );
      log.info('importBackup: finished...');
    } catch (error) {
      log.info(`importBackup: failed, error: ${Errors.toLogFormat(error)}`);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
}

export const backupsService = new BackupsService();
