// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { pipeline } from 'stream/promises';
import { PassThrough } from 'stream';
import type { Readable, Writable } from 'stream';
import { createReadStream, createWriteStream } from 'fs';
import { unlink, stat } from 'fs/promises';
import { ensureFile } from 'fs-extra';
import { join } from 'path';
import { createGzip, createGunzip } from 'zlib';
import { createCipheriv, createHmac, randomBytes } from 'crypto';
import { noop } from 'lodash';
import { BackupLevel } from '@signalapp/libsignal-client/zkgroup';

import { DataReader, DataWriter } from '../../sql/Client';
import * as log from '../../logging/log';
import * as Bytes from '../../Bytes';
import { strictAssert } from '../../util/assert';
import { drop } from '../../util/drop';
import { DelimitedStream } from '../../util/DelimitedStream';
import { appendPaddingStream } from '../../util/logPadding';
import { prependStream } from '../../util/prependStream';
import { appendMacStream } from '../../util/appendMacStream';
import { getIvAndDecipher } from '../../util/getIvAndDecipher';
import { getMacAndUpdateHmac } from '../../util/getMacAndUpdateHmac';
import { missingCaseError } from '../../util/missingCaseError';
import { HOUR } from '../../util/durations';
import { CipherType, HashType } from '../../types/Crypto';
import * as Errors from '../../types/errors';
import { HTTPError } from '../../textsecure/Errors';
import { constantTimeEqual } from '../../Crypto';
import { measureSize } from '../../AttachmentCrypto';
import { isTestOrMockEnvironment } from '../../environment';
import { BackupExportStream } from './export';
import { BackupImportStream } from './import';
import { getKeyMaterial } from './crypto';
import { BackupCredentials } from './credentials';
import { BackupAPI, type DownloadOptionsType } from './api';
import { validateBackup } from './validator';
import { BackupType } from './types';

export { BackupType };

const IV_LENGTH = 16;

const BACKUP_REFRESH_INTERVAL = 24 * HOUR;

export class BackupsService {
  private isStarted = false;
  private isRunning = false;
  private downloadController: AbortController | undefined;

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
    backupLevel: BackupLevel = BackupLevel.Messages,
    backupType = BackupType.Ciphertext
  ): Promise<Uint8Array> {
    const sink = new PassThrough();

    const chunks = new Array<Uint8Array>();
    sink.on('data', chunk => chunks.push(chunk));
    await this.exportBackup(sink, backupLevel, backupType);

    return Bytes.concatenate(chunks);
  }

  // Test harness
  public async exportToDisk(
    path: string,
    backupLevel: BackupLevel = BackupLevel.Messages,
    backupType = BackupType.Ciphertext
  ): Promise<number> {
    const size = await this.exportBackup(
      createWriteStream(path),
      backupLevel,
      backupType
    );

    if (backupType === BackupType.Ciphertext) {
      await validateBackup(path, size);
    }

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

  public cancelDownload(): void {
    if (this.downloadController) {
      log.warn('importBackup: canceling download');
      this.downloadController.abort();
      this.downloadController = undefined;
    } else {
      log.error('importBackup: not canceling download, not running');
    }
  }

  public async download(
    downloadPath: string,
    { onProgress }: Omit<DownloadOptionsType, 'downloadOffset'>
  ): Promise<boolean> {
    const controller = new AbortController();

    // Abort previous download
    this.downloadController?.abort();
    this.downloadController = controller;

    let downloadOffset = 0;
    try {
      ({ size: downloadOffset } = await stat(downloadPath));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }

      // File is missing - start from the beginning
    }

    try {
      await ensureFile(downloadPath);

      if (controller.signal.aborted) {
        return false;
      }

      const stream = await this.api.download({
        downloadOffset,
        onProgress,
        abortSignal: controller.signal,
      });

      if (controller.signal.aborted) {
        return false;
      }

      await pipeline(
        stream,
        createWriteStream(downloadPath, {
          flags: 'a',
          start: downloadOffset,
        })
      );

      if (controller.signal.aborted) {
        return false;
      }

      this.downloadController = undefined;

      // Too late to cancel now
      try {
        await this.importFromDisk(downloadPath);
      } finally {
        await unlink(downloadPath);
      }
    } catch (error) {
      // Download canceled
      if (error.name === 'AbortError') {
        return false;
      }

      // No backup on the server
      if (error instanceof HTTPError && error.code === 404) {
        return false;
      }

      try {
        await unlink(downloadPath);
      } catch {
        // Best-effort
      }
      throw error;
    }

    return true;
  }

  public async importBackup(
    createBackupStream: () => Readable,
    backupType = BackupType.Ciphertext
  ): Promise<void> {
    strictAssert(!this.isRunning, 'BackupService is already running');

    log.info(`importBackup: starting ${backupType}...`);
    this.isRunning = true;

    try {
      const importStream = await BackupImportStream.create(backupType);
      if (backupType === BackupType.Ciphertext) {
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
          importStream
        );

        strictAssert(
          constantTimeEqual(hmac.digest(), theirMac),
          'importBackup: Bad MAC, second pass'
        );
      } else if (backupType === BackupType.TestOnlyPlaintext) {
        strictAssert(
          isTestOrMockEnvironment(),
          'Plaintext backups can be imported only in test harness'
        );
        await pipeline(
          createBackupStream(),
          new DelimitedStream(),
          importStream
        );
      } else {
        throw missingCaseError(backupType);
      }

      log.info('importBackup: finished...');
    } catch (error) {
      log.info(`importBackup: failed, error: ${Errors.toLogFormat(error)}`);
      throw error;
    } finally {
      this.isRunning = false;

      if (window.SignalCI) {
        window.SignalCI.handleEvent('backupImportComplete', null);
      }
    }
  }

  public async fetchAndSaveBackupCdnObjectMetadata(): Promise<void> {
    log.info('fetchAndSaveBackupCdnObjectMetadata: clearing existing metadata');
    await DataWriter.clearAllBackupCdnObjectMetadata();

    let cursor: string | undefined;
    const PAGE_SIZE = 1000;
    let numObjects = 0;
    do {
      log.info('fetchAndSaveBackupCdnObjectMetadata: fetching next page');
      // eslint-disable-next-line no-await-in-loop
      const listResult = await this.api.listMedia({ cursor, limit: PAGE_SIZE });

      // eslint-disable-next-line no-await-in-loop
      await DataWriter.saveBackupCdnObjectMetadata(
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
    const storedInfo = await DataReader.getBackupCdnObjectMetadata(mediaId);
    if (!storedInfo) {
      return { isInBackupTier: false };
    }

    return { isInBackupTier: true, cdnNumber: storedInfo.cdnNumber };
  }

  private async exportBackup(
    sink: Writable,
    backupLevel: BackupLevel = BackupLevel.Messages,
    backupType = BackupType.Ciphertext
  ): Promise<number> {
    strictAssert(!this.isRunning, 'BackupService is already running');

    log.info('exportBackup: starting...');
    this.isRunning = true;

    try {
      // TODO (DESKTOP-7168): Update mock-server to support this endpoint
      if (window.SignalCI || backupType === BackupType.TestOnlyPlaintext) {
        strictAssert(
          isTestOrMockEnvironment(),
          'Plaintext backups can be exported only in test harness'
        );
      } else {
        // We first fetch the latest info on what's on the CDN, since this affects the
        // filePointers we will generate during export
        log.info('Fetching latest backup CDN metadata');
        await this.fetchAndSaveBackupCdnObjectMetadata();
      }

      const { aesKey, macKey } = getKeyMaterial();
      const recordStream = new BackupExportStream(backupType);

      recordStream.run(backupLevel);

      const iv = randomBytes(IV_LENGTH);

      let totalBytes = 0;

      if (backupType === BackupType.Ciphertext) {
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
      } else if (backupType === BackupType.TestOnlyPlaintext) {
        strictAssert(
          isTestOrMockEnvironment(),
          'Plaintext backups can be exported only in test harness'
        );
        await pipeline(recordStream, sink);
      } else {
        throw missingCaseError(backupType);
      }

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
      log.error('Backup: periodic refresh failed', Errors.toLogFormat(error));
    }
  }
}

export const backupsService = new BackupsService();
