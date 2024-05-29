// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { pipeline } from 'stream/promises';
import { PassThrough } from 'stream';
import type { Readable, Writable } from 'stream';
import { createReadStream, createWriteStream } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { createGzip, createGunzip } from 'zlib';
import { createCipheriv, createHmac, randomBytes } from 'crypto';
import { noop } from 'lodash';
import { BackupLevel } from '@signalapp/libsignal-client/zkgroup';

import * as log from '../../logging/log';
import * as Bytes from '../../Bytes';
import { strictAssert } from '../../util/assert';
import { drop } from '../../util/drop';
import { DelimitedStream } from '../../util/DelimitedStream';
import { appendPaddingStream } from '../../util/logPadding';
import { prependStream } from '../../util/prependStream';
import { appendMacStream } from '../../util/appendMacStream';
import { HOUR } from '../../util/durations';
import { CipherType, HashType } from '../../types/Crypto';
import * as Errors from '../../types/errors';
import { constantTimeEqual } from '../../Crypto';
import {
  getIvAndDecipher,
  getMacAndUpdateHmac,
  measureSize,
} from '../../AttachmentCrypto';
import { BackupExportStream } from './export';
import { BackupImportStream } from './import';
import { getKeyMaterial } from './crypto';
import { BackupCredentials } from './credentials';
import { BackupAPI } from './api';
import { validateBackup } from './validator';

const IV_LENGTH = 16;

const BACKUP_REFRESH_INTERVAL = 24 * HOUR;

export class BackupsService {
  private isStarted = false;
  private isRunning = false;

  public readonly credentials = new BackupCredentials();
  public readonly api = new BackupAPI(this.credentials);

  public start(): void {
    if (this.isStarted) {
      log.warn('BackupsService: already started');
      return;
    }

    this.isStarted = true;
    log.info('BackupsService: starting...');

    setInterval(() => {
      drop(this.runPeriodicRefresh());
    }, BACKUP_REFRESH_INTERVAL);

    drop(this.runPeriodicRefresh());
    this.credentials.start();

    window.Whisper.events.on('userChanged', () => {
      drop(this.credentials.clearCache());
      this.api.clearCache();
    });
  }

  public async upload(): Promise<void> {
    const fileName = `backup-${randomBytes(32).toString('hex')}`;
    const filePath = join(window.BasePaths.temp, fileName);

    const backupLevel = await this.credentials.getBackupLevel();
    log.info(`exportBackup: starting, backup level: ${backupLevel}...`);

    try {
      const fileSize = await this.exportToDisk(filePath, backupLevel);

      await this.api.upload(filePath, fileSize);
    } finally {
      try {
        await unlink(filePath);
      } catch {
        // Ignore
      }
    }
  }

  // Test harness
  public async exportBackupData(
    backupLevel: BackupLevel = BackupLevel.Messages
  ): Promise<Uint8Array> {
    const sink = new PassThrough();

    const chunks = new Array<Uint8Array>();
    sink.on('data', chunk => chunks.push(chunk));
    await this.exportBackup(sink, backupLevel);

    return Bytes.concatenate(chunks);
  }

  // Test harness
  public async exportToDisk(
    path: string,
    backupLevel: BackupLevel = BackupLevel.Messages
  ): Promise<number> {
    const size = await this.exportBackup(createWriteStream(path), backupLevel);

    await validateBackup(path, size);

    return size;
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

  public async importFromDisk(backupFile: string): Promise<void> {
    return backupsService.importBackup(() => createReadStream(backupFile));
  }

  public async importBackup(createBackupStream: () => Readable): Promise<void> {
    strictAssert(!this.isRunning, 'BackupService is already running');

    log.info('importBackup: starting...');
    this.isRunning = true;

    try {
      const { aesKey, macKey } = getKeyMaterial();

      // First pass - don't decrypt, only verify mac
      let hmac = createHmac(HashType.size256, macKey);
      let theirMac: Uint8Array | undefined;

      const sink = new PassThrough();
      // Discard the data in the first pass
      sink.resume();

      await pipeline(
        createBackupStream(),
        getMacAndUpdateHmac(hmac, theirMacValue => {
          theirMac = theirMacValue;
        }),
        sink
      );

      strictAssert(theirMac != null, 'importBackup: Missing MAC');
      strictAssert(
        constantTimeEqual(hmac.digest(), theirMac),
        'importBackup: Bad MAC'
      );

      // Second pass - decrypt (but still check the mac at the end)
      hmac = createHmac(HashType.size256, macKey);

      await pipeline(
        createBackupStream(),
        getMacAndUpdateHmac(hmac, noop),
        getIvAndDecipher(aesKey),
        createGunzip(),
        new DelimitedStream(),
        new BackupImportStream()
      );

      strictAssert(
        constantTimeEqual(hmac.digest(), theirMac),
        'importBackup: Bad MAC, second pass'
      );

      log.info('importBackup: finished...');
    } catch (error) {
      log.info(`importBackup: failed, error: ${Errors.toLogFormat(error)}`);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  public async fetchAndSaveBackupCdnObjectMetadata(): Promise<void> {
    log.info('fetchAndSaveBackupCdnObjectMetadata: clearing existing metadata');
    await window.Signal.Data.clearAllBackupCdnObjectMetadata();

    let cursor: string | undefined;
    const PAGE_SIZE = 1000;
    let numObjects = 0;
    do {
      log.info('fetchAndSaveBackupCdnObjectMetadata: fetching next page');
      // eslint-disable-next-line no-await-in-loop
      const listResult = await this.api.listMedia({ cursor, limit: PAGE_SIZE });

      // eslint-disable-next-line no-await-in-loop
      await window.Signal.Data.saveBackupCdnObjectMetadata(
        listResult.storedMediaObjects.map(object => ({
          mediaId: object.mediaId,
          cdnNumber: object.cdn,
          sizeOnBackupCdn: object.objectLength,
        }))
      );
      numObjects += listResult.storedMediaObjects.length;

      cursor = listResult.cursor ?? undefined;
    } while (cursor);

    log.info(
      `fetchAndSaveBackupCdnObjectMetadata: finished fetching metadata for ${numObjects} objects`
    );
  }

  public async getBackupCdnInfo(
    mediaId: string
  ): Promise<
    { isInBackupTier: true; cdnNumber: number } | { isInBackupTier: false }
  > {
    const storedInfo = await window.Signal.Data.getBackupCdnObjectMetadata(
      mediaId
    );
    if (!storedInfo) {
      return { isInBackupTier: false };
    }

    return { isInBackupTier: true, cdnNumber: storedInfo.cdnNumber };
  }

  private async exportBackup(
    sink: Writable,
    backupLevel: BackupLevel = BackupLevel.Messages
  ): Promise<number> {
    strictAssert(!this.isRunning, 'BackupService is already running');

    log.info('exportBackup: starting...');
    this.isRunning = true;

    try {
      // TODO (DESKTOP-7168): Update mock-server to support this endpoint
      if (!window.SignalCI) {
        // We first fetch the latest info on what's on the CDN, since this affects the
        // filePointers we will generate during export
        log.info('Fetching latest backup CDN metadata');
        await this.fetchAndSaveBackupCdnObjectMetadata();
      }

      const { aesKey, macKey } = getKeyMaterial();
      const recordStream = new BackupExportStream();

      recordStream.run(backupLevel);

      const iv = randomBytes(IV_LENGTH);

      let totalBytes = 0;

      await pipeline(
        recordStream,
        createGzip(),
        appendPaddingStream(),
        createCipheriv(CipherType.AES256CBC, aesKey, iv),
        prependStream(iv),
        appendMacStream(macKey),
        measureSize(size => {
          totalBytes = size;
        }),
        sink
      );

      return totalBytes;
    } finally {
      log.info('exportBackup: finished...');
      this.isRunning = false;
    }
  }

  private async runPeriodicRefresh(): Promise<void> {
    try {
      await this.api.refresh();
      log.info('Backup: refreshed');
    } catch (error) {
      log.error('Backup: periodic refresh kufailed', Errors.toLogFormat(error));
    }
  }
}

export const backupsService = new BackupsService();
