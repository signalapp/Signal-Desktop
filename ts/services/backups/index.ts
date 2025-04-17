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
import { BackupKey } from '@signalapp/libsignal-client/dist/AccountKeys';
import { throttle } from 'lodash/fp';

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
import { DAY, HOUR, MINUTE } from '../../util/durations';
import type { ExplodePromiseResultType } from '../../util/explodePromise';
import { explodePromise } from '../../util/explodePromise';
import type { RetryBackupImportValue } from '../../state/ducks/installer';
import { CipherType, HashType } from '../../types/Crypto';
import {
  InstallScreenBackupStep,
  InstallScreenBackupError,
} from '../../types/InstallScreen';
import * as Errors from '../../types/errors';
import {
  BackupCredentialType,
  type BackupsSubscriptionType,
  type BackupStatusType,
} from '../../types/backups';
import { HTTPError } from '../../textsecure/Errors';
import { constantTimeEqual } from '../../Crypto';
import { measureSize } from '../../AttachmentCrypto';
import { isTestOrMockEnvironment } from '../../environment';
import { runStorageServiceSyncJob } from '../storage';
import { BackupExportStream, type StatsType } from './export';
import { BackupImportStream } from './import';
import { getKeyMaterial } from './crypto';
import { BackupCredentials } from './credentials';
import { BackupAPI } from './api';
import { validateBackup, ValidationType } from './validator';
import { BackupType } from './types';
import {
  BackupInstallerError,
  BackupDownloadFailedError,
  BackupImportCanceledError,
  BackupProcessingError,
  RelinkRequestedError,
} from './errors';
import { FileStream } from './util/FileStream';
import { MemoryStream } from './util/MemoryStream';
import { ToastType } from '../../types/Toast';
import { isAdhoc, isNightly } from '../../util/version';
import { getMessageQueueTime } from '../../util/getMessageQueueTime';

export { BackupType };

const IV_LENGTH = 16;

const BACKUP_REFRESH_INTERVAL = 24 * HOUR;

export type DownloadOptionsType = Readonly<{
  onProgress?: (
    backupStep: InstallScreenBackupStep,
    currentBytes: number,
    totalBytes: number
  ) => void;
  abortSignal?: AbortSignal;
}>;

type DoDownloadOptionsType = Readonly<{
  downloadPath: string;
  ephemeralKey?: Uint8Array;
  onProgress?: (
    backupStep: InstallScreenBackupStep,
    currentBytes: number,
    totalBytes: number
  ) => void;
}>;

export type ImportOptionsType = Readonly<{
  backupType?: BackupType;
  ephemeralKey?: Uint8Array;
  onProgress?: (currentBytes: number, totalBytes: number) => void;
}>;

export type ExportResultType = Readonly<{
  totalBytes: number;
  stats: Readonly<StatsType>;
}>;

export type ValidationResultType = Readonly<
  | {
      result: ExportResultType;
    }
  | {
      error: string;
    }
>;

export class BackupsService {
  #isStarted = false;
  #isRunning: 'import' | 'export' | false = false;
  #importController: AbortController | undefined;
  #downloadController: AbortController | undefined;

  #downloadRetryPromise:
    | ExplodePromiseResultType<RetryBackupImportValue>
    | undefined;

  public readonly credentials = new BackupCredentials();
  public readonly api = new BackupAPI(this.credentials);
  public readonly throttledFetchCloudBackupStatus = throttle(
    MINUTE,
    this.fetchCloudBackupStatus.bind(this)
  );
  public readonly throttledFetchSubscriptionStatus = throttle(
    MINUTE,
    this.fetchSubscriptionStatus.bind(this)
  );

  public start(): void {
    if (this.#isStarted) {
      log.warn('BackupsService: already started');
      return;
    }

    this.#isStarted = true;
    log.info('BackupsService: starting...');

    setInterval(() => {
      drop(this.#runPeriodicRefresh());
    }, BACKUP_REFRESH_INTERVAL);

    drop(this.#runPeriodicRefresh());
    this.credentials.start();

    window.Whisper.events.on('userChanged', () => {
      drop(this.credentials.clearCache());
      this.api.clearCache();
    });
  }
  public async downloadAndImport(
    options: DownloadOptionsType
  ): Promise<{ wasBackupImported: boolean }> {
    const backupDownloadPath = window.storage.get('backupDownloadPath');
    if (!backupDownloadPath) {
      log.warn('backups.downloadAndImport: no backup download path, skipping');
      return { wasBackupImported: false };
    }

    log.info('backups.downloadAndImport: downloading...');

    const ephemeralKey = window.storage.get('backupEphemeralKey');

    const absoluteDownloadPath =
      window.Signal.Migrations.getAbsoluteDownloadsPath(backupDownloadPath);
    let hasBackup = false;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        // eslint-disable-next-line no-await-in-loop
        hasBackup = await this.#doDownloadAndImport({
          downloadPath: absoluteDownloadPath,
          onProgress: options.onProgress,
          ephemeralKey,
        });

        if (!hasBackup) {
          // If the primary cancels sync on their end, then we can link without sync
          log.info('backups.downloadAndImport: missing backup');
          window.reduxActions.installer.handleMissingBackup();
        }
      } catch (error) {
        this.#downloadRetryPromise = explodePromise<RetryBackupImportValue>();

        let installerError: InstallScreenBackupError;
        if (error instanceof BackupInstallerError) {
          log.error(
            'backups.downloadAndImport: got installer error',
            Errors.toLogFormat(error)
          );
          ({ installerError } = error);
        } else {
          log.error(
            'backups.downloadAndImport: unknown error, prompting user to retry'
          );
          installerError = InstallScreenBackupError.Retriable;
        }

        window.reduxActions.installer.updateBackupImportProgress({
          error: installerError,
        });

        // For download errors, wait for user confirmation to retry or unlink
        const nextStep =
          error instanceof BackupImportCanceledError
            ? 'cancel'
            : // eslint-disable-next-line no-await-in-loop
              await this.#downloadRetryPromise.promise;
        if (nextStep === 'retry') {
          log.warn('backups.downloadAndImport: retrying');
          continue;
        }

        if (nextStep !== 'cancel') {
          throw missingCaseError(nextStep);
        }

        // If we are here: the user has either canceled manually, or after
        // getting an error (potentially fatal).
        log.warn('backups.downloadAndImport: unlinking');

        // eslint-disable-next-line no-await-in-loop
        await this.#unlinkAndDeleteAllData();

        try {
          // eslint-disable-next-line no-await-in-loop
          await unlink(absoluteDownloadPath);
        } catch {
          // Best-effort
        }

        // Make sure to fail the backup import process so that background.ts
        // will not wait for the syncs.
        throw error;
      }
      break;
    }

    await window.storage.remove('backupDownloadPath');
    await window.storage.remove('backupEphemeralKey');
    await window.storage.remove('backupTransitArchive');
    await window.storage.put('isRestoredFromBackup', hasBackup);

    log.info('backups.downloadAndImport: done');

    return { wasBackupImported: hasBackup };
  }

  public retryDownload(): void {
    if (!this.#downloadRetryPromise) {
      return;
    }

    this.#downloadRetryPromise.resolve('retry');
  }

  public async upload(): Promise<void> {
    // Make sure we are up-to-date on storage service
    {
      const { promise: storageService, resolve } = explodePromise<void>();
      window.Whisper.events.once('storageService:syncComplete', resolve);

      runStorageServiceSyncJob({ reason: 'backups.upload' });
      await storageService;
    }

    // Clear message queue
    await window.waitForEmptyEventQueue();

    // Make sure all batches are flushed
    await Promise.all([
      window.waitForAllBatchers(),
      window.flushAllWaitBatchers(),
    ]);

    const fileName = `backup-${randomBytes(32).toString('hex')}`;
    const filePath = join(window.BasePaths.temp, fileName);

    const backupLevel = await this.credentials.getBackupLevel(
      BackupCredentialType.Media
    );
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
    backupLevel: BackupLevel = BackupLevel.Free,
    backupType = BackupType.Ciphertext
  ): Promise<{ data: Uint8Array } & ExportResultType> {
    const sink = new PassThrough();

    const chunks = new Array<Uint8Array>();
    sink.on('data', chunk => chunks.push(chunk));
    const result = await this.#exportBackup(sink, backupLevel, backupType);

    return {
      ...result,
      data: Bytes.concatenate(chunks),
    };
  }

  // Test harness
  public async exportToDisk(
    path: string,
    backupLevel: BackupLevel = BackupLevel.Free,
    backupType = BackupType.Ciphertext
  ): Promise<number> {
    const { totalBytes } = await this.#exportBackup(
      createWriteStream(path),
      backupLevel,
      backupType
    );

    if (backupType === BackupType.Ciphertext) {
      await validateBackup(
        () => new FileStream(path),
        totalBytes,
        isTestOrMockEnvironment()
          ? ValidationType.Internal
          : ValidationType.Export
      );
    }

    return totalBytes;
  }

  // Test harness
  public async _internalValidate(
    backupLevel: BackupLevel = BackupLevel.Free,
    backupType = BackupType.Ciphertext
  ): Promise<ValidationResultType> {
    try {
      const { data, ...result } = await this.exportBackupData(
        backupLevel,
        backupType
      );
      const buffer = Buffer.from(data);

      await validateBackup(
        () => new MemoryStream(buffer),
        buffer.byteLength,
        ValidationType.Internal
      );

      return { result };
    } catch (error) {
      return { error: Errors.toLogFormat(error) };
    }
  }

  // Test harness
  public async exportWithDialog(): Promise<void> {
    const { data } = await this.exportBackupData();

    const { saveAttachmentToDisk } = window.Signal.Migrations;

    await saveAttachmentToDisk({
      name: 'backup.bin',
      data,
    });
  }

  public async importFromDisk(
    backupFile: string,
    options?: ImportOptionsType
  ): Promise<void> {
    return this.importBackup(() => createReadStream(backupFile), options);
  }

  public cancelDownloadAndImport(): void {
    if (!this.#downloadController && !this.#importController) {
      log.error(
        'cancelDownloadAndImport: not canceling, download or import is not running'
      );
      return;
    }

    if (this.#downloadController) {
      log.warn('cancelDownloadAndImport: canceling download');
      this.#downloadController.abort();
      this.#downloadController = undefined;
      if (this.#downloadRetryPromise) {
        this.#downloadRetryPromise.resolve('cancel');
      }
    }

    if (this.#importController) {
      log.warn('cancelDownloadAndImport: canceling import processing');
      this.#importController.abort();
      this.#importController = undefined;
    }
  }

  public async importBackup(
    createBackupStream: () => Readable,
    {
      backupType = BackupType.Ciphertext,
      ephemeralKey,
      onProgress,
    }: ImportOptionsType = {}
  ): Promise<void> {
    strictAssert(!this.#isRunning, 'BackupService is already running');

    window.IPC.startTrackingQueryStats();

    log.info(`importBackup: starting ${backupType}...`);
    this.#isRunning = 'import';
    const importStart = Date.now();

    await DataWriter.disableMessageInsertTriggers();
    await DataWriter.disableFSync();

    try {
      const controller = new AbortController();

      this.#importController?.abort();
      this.#importController = controller;

      window.ConversationController.setReadOnly(true);

      const importStream = await BackupImportStream.create(backupType);
      if (backupType === BackupType.Ciphertext) {
        const { aesKey, macKey } = getKeyMaterial(
          ephemeralKey ? new BackupKey(Buffer.from(ephemeralKey)) : undefined
        );

        // First pass - don't decrypt, only verify mac
        let hmac = createHmac(HashType.size256, macKey);
        let theirMac: Uint8Array | undefined;
        let totalBytes = 0;

        const sink = new PassThrough();
        sink.on('data', chunk => {
          totalBytes += chunk.byteLength;
        });
        // Discard the data in the first pass
        sink.resume();

        await pipeline(
          createBackupStream(),
          getMacAndUpdateHmac(hmac, theirMacValue => {
            theirMac = theirMacValue;
          }),
          sink
        );

        if (controller.signal.aborted) {
          throw new BackupImportCanceledError();
        }

        onProgress?.(0, totalBytes);

        strictAssert(theirMac != null, 'importBackup: Missing MAC');
        strictAssert(
          constantTimeEqual(hmac.digest(), theirMac),
          'importBackup: Bad MAC'
        );

        // Second pass - decrypt (but still check the mac at the end)
        hmac = createHmac(HashType.size256, macKey);

        const progressReporter = new PassThrough();
        progressReporter.pause();

        let currentBytes = 0;
        progressReporter.on('data', chunk => {
          currentBytes += chunk.byteLength;
          onProgress?.(currentBytes, totalBytes);
        });

        await pipeline(
          createBackupStream(),
          getMacAndUpdateHmac(hmac, noop),
          progressReporter,
          getIvAndDecipher(aesKey),
          createGunzip(),
          new DelimitedStream(),
          importStream,
          { signal: controller.signal }
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
        strictAssert(
          ephemeralKey == null,
          'Plaintext backups cannot have ephemeral key'
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
      if (error.name === 'AbortError') {
        log.info('importBackup: canceled by user');
        throw new BackupImportCanceledError();
      }

      log.error(`importBackup: failed, error: ${Errors.toLogFormat(error)}`);

      if (isNightly(window.getVersion()) || isAdhoc(window.getVersion())) {
        window.reduxActions.toast.showToast({
          toastType: ToastType.FailedToImportBackup,
        });
      }

      throw error;
    } finally {
      window.ConversationController.setReadOnly(false);
      this.#isRunning = false;
      this.#importController = undefined;

      await DataWriter.enableMessageInsertTriggersAndBackfill();
      await DataWriter.enableFSyncAndCheckpoint();

      window.IPC.stopTrackingQueryStats({ epochName: 'Backup Import' });
      if (window.SignalCI) {
        window.SignalCI.handleEvent('backupImportComplete', {
          duration: Date.now() - importStart,
        });
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

  async #doDownloadAndImport({
    downloadPath,
    ephemeralKey,
    onProgress,
  }: DoDownloadOptionsType): Promise<boolean> {
    const controller = new AbortController();

    // Abort previous download
    this.#downloadController?.abort();
    this.#downloadController = controller;

    let downloadOffset = 0;
    try {
      ({ size: downloadOffset } = await stat(downloadPath));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }

      // File is missing - start from the beginning
    }

    const onDownloadProgress = (
      currentBytes: number,
      totalBytes: number
    ): void => {
      onProgress?.(InstallScreenBackupStep.Download, currentBytes, totalBytes);
    };

    await ensureFile(downloadPath);
    if (controller.signal.aborted) {
      throw new BackupImportCanceledError();
    }

    let stream: Readable;

    try {
      if (ephemeralKey == null) {
        stream = await this.api.download({
          downloadOffset,
          onProgress: onDownloadProgress,
          abortSignal: controller.signal,
        });
      } else {
        let archive = window.storage.get('backupTransitArchive');
        if (archive == null) {
          const response = await this.api.getTransferArchive(controller.signal);
          if ('error' in response) {
            switch (response.error) {
              case 'RELINK_REQUESTED':
                throw new RelinkRequestedError();

              // Primary decided to abort syncing process; continue on with no backup
              case 'CONTINUE_WITHOUT_UPLOAD':
                log.error(
                  'backups.doDownloadAndImport: primary requested to continue without syncing'
                );
                return false;
              default:
                throw missingCaseError(response.error);
            }
          }

          archive = {
            cdn: response.cdn,
            key: response.key,
          };
          await window.storage.put('backupTransitArchive', archive);
        }

        stream = await this.api.downloadEphemeral({
          archive,
          downloadOffset,
          onProgress: onDownloadProgress,
          abortSignal: controller.signal,
        });
      }
    } catch (error) {
      if (controller.signal.aborted) {
        throw new BackupImportCanceledError();
      }

      // No backup on the server
      if (error instanceof HTTPError && error.code === 404) {
        return false;
      }

      if (error instanceof BackupInstallerError) {
        throw error;
      }

      log.error(
        'backups.doDownloadAndImport: error downloading backup file',
        Errors.toLogFormat(error)
      );
      throw new BackupDownloadFailedError();
    }

    if (controller.signal.aborted) {
      throw new BackupImportCanceledError();
    }

    try {
      await pipeline(
        stream,
        createWriteStream(downloadPath, {
          flags: 'a',
          start: downloadOffset,
        })
      );

      if (controller.signal.aborted) {
        throw new BackupImportCanceledError();
      }

      this.#downloadController = undefined;

      try {
        // Import and start writing to the DB. Make sure we are unlinked
        // if the import process is aborted due to error or restart.
        const password = window.storage.get('password');
        strictAssert(password != null, 'Must be registered to import backup');

        await window.storage.remove('password');

        await this.importFromDisk(downloadPath, {
          ephemeralKey,
          onProgress: (currentBytes, totalBytes) => {
            onProgress?.(
              InstallScreenBackupStep.Process,
              currentBytes,
              totalBytes
            );
          },
        });

        // Restore password on success
        await window.storage.put('password', password);
      } catch (e) {
        // Error or manual cancel during import; this is non-retriable
        if (e instanceof BackupInstallerError) {
          throw e;
        } else {
          throw new BackupProcessingError(e);
        }
      } finally {
        await unlink(downloadPath);
      }
    } catch (error) {
      // Download canceled
      if (error.name === 'AbortError') {
        throw new BackupImportCanceledError();
      }

      // Other errors bubble up and can be retried
      throw error;
    }

    return true;
  }

  async #exportBackup(
    sink: Writable,
    backupLevel: BackupLevel = BackupLevel.Free,
    backupType = BackupType.Ciphertext
  ): Promise<ExportResultType> {
    strictAssert(!this.#isRunning, 'BackupService is already running');

    log.info('exportBackup: starting...');
    this.#isRunning = 'export';

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
          measureSize({
            onComplete: size => {
              totalBytes = size;
            },
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

      return { totalBytes, stats: recordStream.getStats() };
    } finally {
      log.info('exportBackup: finished...');
      this.#isRunning = false;
    }
  }

  async #runPeriodicRefresh(): Promise<void> {
    try {
      await this.api.refresh();
      log.info('Backup: refreshed');
    } catch (error) {
      log.error('Backup: periodic refresh failed', Errors.toLogFormat(error));
    }
    drop(this.fetchCloudBackupStatus());
    drop(this.fetchSubscriptionStatus());
  }

  async #unlinkAndDeleteAllData() {
    window.reduxActions.installer.updateBackupImportProgress({
      error: InstallScreenBackupError.Canceled,
    });

    try {
      await window.textsecure.server?.unlink();
    } catch (e) {
      log.warn(
        'Error while unlinking; this may be expected for the unlink operation',
        Errors.toLogFormat(e)
      );
    }

    try {
      log.info('backups.unlinkAndDeleteAllData: deleting all data');
      await window.textsecure.storage.protocol.removeAllData();
      log.info('backups.unlinkAndDeleteAllData: all data deleted successfully');
    } catch (e) {
      log.error(
        'backups.unlinkAndDeleteAllData: unable to remove all data',
        Errors.toLogFormat(e)
      );
    }

    // The QR code should be regenerated only after all data is cleared to prevent
    // a race where the QR code doesn't show the backup capability
    window.reduxActions.installer.startInstaller();
  }

  public isImportRunning(): boolean {
    return this.#isRunning === 'import';
  }
  public isExportRunning(): boolean {
    return this.#isRunning === 'export';
  }

  #getBackupTierFromStorage(): BackupLevel | null {
    const backupTier = window.storage.get('backupTier');
    switch (backupTier) {
      case BackupLevel.Free:
        return BackupLevel.Free;
      case BackupLevel.Paid:
        return BackupLevel.Paid;
      case undefined:
        return null;
      default:
        log.error('Unknown backupTier in storage', backupTier);
        return null;
    }
  }

  async #getBackedUpMediaSize(): Promise<number> {
    const backupInfo = await this.api.getInfo(BackupCredentialType.Media);
    return backupInfo.usedSpace ?? 0;
  }

  async fetchCloudBackupStatus(): Promise<BackupStatusType | undefined> {
    let result: BackupStatusType | undefined;
    const [backupProtoInfo, mediaSize] = await Promise.all([
      this.api.getBackupProtoInfo(),
      this.#getBackedUpMediaSize(),
    ]);

    if (backupProtoInfo.backupExists) {
      const { createdAt, size: protoSize } = backupProtoInfo;
      result = {
        createdAt: createdAt.getTime(),
        protoSize,
        mediaSize,
      };
    }

    await window.storage.put('cloudBackupStatus', result);
    return result;
  }

  async fetchSubscriptionStatus(): Promise<
    BackupsSubscriptionType | undefined
  > {
    const backupTier = this.#getBackupTierFromStorage();
    let result: BackupsSubscriptionType;
    switch (backupTier) {
      case null:
      case undefined:
      case BackupLevel.Free:
        result = {
          status: 'free',
          mediaIncludedInBackupDurationDays: getMessageQueueTime() / DAY,
        };
        break;
      case BackupLevel.Paid:
        result = await this.api.getSubscriptionInfo();
        break;
      default:
        throw missingCaseError(backupTier);
    }

    drop(window.storage.put('backupSubscriptionStatus', result));
    return result;
  }

  getCachedCloudBackupStatus(): BackupStatusType | undefined {
    return window.storage.get('cloudBackupStatus');
  }
}

export const backupsService = new BackupsService();
