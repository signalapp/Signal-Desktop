// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { pipeline } from 'node:stream/promises';
import { PassThrough } from 'node:stream';
import type { Readable, Writable } from 'node:stream';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat, unlink } from 'node:fs/promises';
import fsExtra from 'fs-extra';
import { join } from 'node:path';
import { createGzip, createGunzip } from 'node:zlib';
import { createCipheriv, createHmac, randomBytes } from 'node:crypto';
import lodash from 'lodash';
import { BackupLevel } from '@signalapp/libsignal-client/zkgroup.js';
import { BackupKey } from '@signalapp/libsignal-client/dist/AccountKeys.js';
import lodashFp from 'lodash/fp.js';
import { ipcRenderer } from 'electron';

import { DataReader, DataWriter } from '../../sql/Client.preload.js';
import { createLogger } from '../../logging/log.std.js';
import * as Bytes from '../../Bytes.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { drop } from '../../util/drop.std.js';
import { TEMP_PATH } from '../../util/basePaths.preload.js';
import {
  getAbsoluteDownloadsPath,
  saveAttachmentToDisk,
} from '../../util/migrations.preload.js';
import { waitForAllBatchers } from '../../util/batcher.std.js';
import { flushAllWaitBatchers } from '../../util/waitBatcher.std.js';
import { DelimitedStream } from '../../util/DelimitedStream.node.js';
import { appendPaddingStream } from '../../util/logPadding.node.js';
import { prependStream } from '../../util/prependStream.node.js';
import { appendMacStream } from '../../util/appendMacStream.node.js';
import { getMacAndUpdateHmac } from '../../util/getMacAndUpdateHmac.node.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import { HOUR, SECOND } from '../../util/durations/index.std.js';
import type { ExplodePromiseResultType } from '../../util/explodePromise.std.js';
import { explodePromise } from '../../util/explodePromise.std.js';
import type { RetryBackupImportValue } from '../../state/ducks/installer.preload.js';
import { CipherType, HashType } from '../../types/Crypto.std.js';
import {
  InstallScreenBackupStep,
  InstallScreenBackupError,
} from '../../types/InstallScreen.std.js';
import * as Errors from '../../types/errors.std.js';
import {
  BackupCredentialType,
  type BackupsSubscriptionType,
  type BackupStatusType,
} from '../../types/backups.node.js';
import { HTTPError } from '../../types/HTTPError.std.js';
import { constantTimeEqual } from '../../Crypto.node.js';
import { measureSize } from '../../AttachmentCrypto.node.js';
import { signalProtocolStore } from '../../SignalProtocolStore.preload.js';
import { isTestOrMockEnvironment } from '../../environment.std.js';
import { runStorageServiceSyncJob } from '../storage.preload.js';
import { BackupExportStream, type StatsType } from './export.preload.js';
import { BackupImportStream } from './import.preload.js';
import {
  getBackupId,
  getKeyMaterial,
  getLocalBackupMetadataKey,
} from './crypto.preload.js';
import { BackupCredentials } from './credentials.preload.js';
import { BackupAPI } from './api.preload.js';
import {
  validateBackup,
  validateBackupStream,
  ValidationType,
} from './validator.preload.js';
import { BackupType } from './types.std.js';
import {
  BackupInstallerError,
  BackupDownloadFailedError,
  BackupImportCanceledError,
  BackupProcessingError,
  RelinkRequestedError,
} from './errors.std.js';
import { FileStream } from './util/FileStream.node.js';
import { ToastType } from '../../types/Toast.dom.js';
import { isAdhoc, isNightly } from '../../util/version.std.js';
import { isLocalBackupsEnabled } from '../../util/isLocalBackupsEnabled.dom.js';
import type { ValidateLocalBackupStructureResultType } from './util/localBackup.node.js';
import {
  writeLocalBackupMetadata,
  verifyLocalBackupMetadata,
  writeLocalBackupFilesList,
  readLocalBackupFilesList,
  validateLocalBackupStructure,
} from './util/localBackup.node.js';
import { AttachmentLocalBackupManager } from '../../jobs/AttachmentLocalBackupManager.preload.js';
import { decipherWithAesKey } from '../../util/decipherWithAesKey.node.js';
import { areRemoteBackupsTurnedOn } from '../../util/isBackupEnabled.preload.js';
import { unlink as unlinkAccount } from '../../textsecure/WebAPI.preload.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

const { ensureFile } = fsExtra;

const { throttle } = lodashFp;

const { isEqual, noop } = lodash;

const log = createLogger('backupsService');

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
  localBackupSnapshotDir?: string;
  ephemeralKey?: Uint8Array;
  onProgress?: (currentBytes: number, totalBytes: number) => void;
}>;

export type ExportResultType = Readonly<{
  totalBytes: number;
  duration: number;
  stats: Readonly<StatsType>;
}>;

export type LocalBackupExportResultType = ExportResultType & {
  snapshotDir: string;
};

export type ValidationResultType = Readonly<
  | {
      result: ExportResultType | LocalBackupExportResultType;
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

  #localBackupSnapshotDir: string | undefined;

  public readonly credentials = new BackupCredentials();
  public readonly api = new BackupAPI(this.credentials);
  public readonly throttledFetchCloudBackupStatus = throttle(30 * SECOND, () =>
    this.#fetchCloudBackupStatus()
  );
  public readonly throttledFetchSubscriptionStatus = throttle(30 * SECOND, () =>
    this.#fetchSubscriptionStatus()
  );

  public start(): void {
    if (!areRemoteBackupsTurnedOn()) {
      log.warn('remote backups are not turned on; not starting');
      return;
    }

    if (this.#isStarted) {
      log.warn('already started');
      return;
    }

    this.#isStarted = true;
    log.info('starting...');

    setInterval(() => {
      drop(this.#runPeriodicRefresh());
    }, BACKUP_REFRESH_INTERVAL);

    drop(this.#runPeriodicRefresh());
    this.credentials.start();

    window.Whisper.events.on('userChanged', async () => {
      await this.resetCachedData();
    });
  }
  public async downloadAndImport(
    options: DownloadOptionsType
  ): Promise<{ wasBackupImported: boolean }> {
    const backupDownloadPath = itemStorage.get('backupDownloadPath');
    if (!backupDownloadPath) {
      log.warn('backups.downloadAndImport: no backup download path, skipping');
      return { wasBackupImported: false };
    }

    log.info('backups.downloadAndImport: downloading...');

    const ephemeralKey = itemStorage.get('backupEphemeralKey');

    const absoluteDownloadPath = getAbsoluteDownloadsPath(backupDownloadPath);
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

    await itemStorage.remove('backupDownloadPath');
    await itemStorage.remove('backupEphemeralKey');
    await itemStorage.remove('backupTransitArchive');
    await itemStorage.put('isRestoredFromBackup', hasBackup);

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
    await this.#waitForEmptyQueues('backups.upload');

    const fileName = `backup-${randomBytes(32).toString('hex')}`;
    const filePath = join(TEMP_PATH, fileName);

    const backupLevel = await this.credentials.getBackupLevel(
      BackupCredentialType.Media
    );
    log.info(`exportBackup: starting, backup level: ${backupLevel}...`);

    try {
      const { totalBytes } = await this.exportToDisk(filePath, backupLevel);

      await this.api.upload(filePath, totalBytes);
    } finally {
      try {
        await unlink(filePath);
      } catch {
        // Ignore
      }
    }
  }

  public async exportLocalBackup(
    backupsBaseDir: string | undefined = undefined,
    backupLevel: BackupLevel = BackupLevel.Free
  ): Promise<LocalBackupExportResultType> {
    strictAssert(isLocalBackupsEnabled(), 'Local backups must be enabled');

    await this.#waitForEmptyQueues('backups.exportLocalBackup');

    const baseDir =
      backupsBaseDir ??
      join(window.SignalContext.getPath('userData'), 'SignalBackups');
    const snapshotDir = join(baseDir, `signal-backup-${new Date().getTime()}`);
    await mkdir(snapshotDir, { recursive: true });
    const mainProtoPath = join(snapshotDir, 'main');

    log.info('exportLocalBackup: starting');

    const exportResult = await this.exportToDisk(
      mainProtoPath,
      backupLevel,
      BackupType.Ciphertext,
      snapshotDir
    );

    log.info('exportLocalBackup: writing metadata');
    const metadataArgs = {
      snapshotDir,
      backupId: getBackupId(),
      metadataKey: getLocalBackupMetadataKey(),
    };
    await writeLocalBackupMetadata(metadataArgs);
    await verifyLocalBackupMetadata(metadataArgs);

    log.info(
      'exportLocalBackup: waiting for AttachmentLocalBackupManager to finish'
    );
    await AttachmentLocalBackupManager.waitForIdle();

    log.info(`exportLocalBackup: exported to disk: ${snapshotDir}`);
    return { ...exportResult, snapshotDir };
  }

  public async stageLocalBackupForImport(
    snapshotDir: string
  ): Promise<ValidateLocalBackupStructureResultType> {
    const result = await validateLocalBackupStructure(snapshotDir);
    const { success, error } = result;
    if (success) {
      this.#localBackupSnapshotDir = snapshotDir;
      log.info(
        `stageLocalBackupForImport: Staged ${snapshotDir} for import. Please link to perform import.`
      );
    } else {
      this.#localBackupSnapshotDir = undefined;
      log.info(
        `stageLocalBackupForImport: Invalid snapshot ${snapshotDir}. Error: ${error}.`
      );
    }
    return result;
  }

  public isLocalBackupStaged(): boolean {
    return Boolean(this.#localBackupSnapshotDir);
  }

  public async importLocalBackup(): Promise<void> {
    strictAssert(
      this.#localBackupSnapshotDir,
      'importLocalBackup: Staged backup is required, use stageLocalBackupForImport()'
    );

    log.info(`importLocalBackup: Importing ${this.#localBackupSnapshotDir}`);

    const backupFile = join(this.#localBackupSnapshotDir, 'main');
    await this.importFromDisk(backupFile, {
      localBackupSnapshotDir: this.#localBackupSnapshotDir,
    });

    await verifyLocalBackupMetadata({
      snapshotDir: this.#localBackupSnapshotDir,
      backupId: getBackupId(),
      metadataKey: getLocalBackupMetadataKey(),
    });

    this.#localBackupSnapshotDir = undefined;

    log.info('importLocalBackup: Done');
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

  public async exportToDisk(
    path: string,
    backupLevel: BackupLevel = BackupLevel.Free,
    backupType = BackupType.Ciphertext,
    localBackupSnapshotDir: string | undefined = undefined
  ): Promise<ExportResultType> {
    const exportResult = await this.#exportBackup(
      createWriteStream(path),
      backupLevel,
      backupType,
      localBackupSnapshotDir
    );

    if (backupType === BackupType.Ciphertext) {
      await validateBackup(
        () => new FileStream(path),
        exportResult.totalBytes,
        isTestOrMockEnvironment()
          ? ValidationType.Internal
          : ValidationType.Export
      );
    }

    return exportResult;
  }

  public async _internalExportLocalBackup(
    backupLevel: BackupLevel = BackupLevel.Free
  ): Promise<ValidationResultType> {
    try {
      const { canceled, dirPath: backupsBaseDir } = await ipcRenderer.invoke(
        'show-open-folder-dialog'
      );
      if (canceled || !backupsBaseDir) {
        return { error: 'Backups directory not selected' };
      }

      const result = await this.exportLocalBackup(backupsBaseDir, backupLevel);
      return { result };
    } catch (error) {
      return { error: Errors.toLogFormat(error) };
    }
  }

  public async _internalStageLocalBackupForImport(): Promise<ValidateLocalBackupStructureResultType> {
    const { canceled, dirPath: snapshotDir } = await ipcRenderer.invoke(
      'show-open-folder-dialog'
    );
    if (canceled || !snapshotDir) {
      return {
        success: false,
        error: 'File dialog canceled',
        snapshotDir: undefined,
      };
    }

    return this.stageLocalBackupForImport(snapshotDir);
  }

  // Test harness
  public async _internalValidate(
    backupLevel: BackupLevel = BackupLevel.Free,
    backupType = BackupType.Ciphertext
  ): Promise<ValidationResultType> {
    try {
      const start = Date.now();

      const recordStream = new BackupExportStream(backupType);

      recordStream.run(backupLevel);

      const totalBytes = await validateBackupStream(recordStream);

      const duration = Date.now() - start;

      return {
        result: { duration, stats: recordStream.getStats(), totalBytes },
      };
    } catch (error) {
      return { error: Errors.toLogFormat(error) };
    }
  }

  // Test harness
  public async exportWithDialog(): Promise<void> {
    const { data } = await this.exportBackupData();

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
      localBackupSnapshotDir = undefined,
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

      const importStream = await BackupImportStream.create(
        backupType,
        localBackupSnapshotDir
      );
      if (backupType === BackupType.Ciphertext) {
        const { aesKey, macKey } = getKeyMaterial(
          ephemeralKey ? new BackupKey(ephemeralKey) : undefined
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
          decipherWithAesKey(aesKey),
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
        let archive = itemStorage.get('backupTransitArchive');
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
          await itemStorage.put('backupTransitArchive', archive);
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
        const password = itemStorage.get('password');
        strictAssert(password != null, 'Must be registered to import backup');

        await itemStorage.remove('password');

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
        await itemStorage.put('password', password);
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
    backupType = BackupType.Ciphertext,
    localBackupSnapshotDir: string | undefined = undefined
  ): Promise<ExportResultType> {
    strictAssert(!this.#isRunning, 'BackupService is already running');

    log.info('exportBackup: starting...');
    this.#isRunning = 'export';

    const start = Date.now();
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

      recordStream.run(backupLevel, localBackupSnapshotDir);

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

      if (localBackupSnapshotDir) {
        log.info('exportBackup: writing local backup files list');
        const filesWritten = await writeLocalBackupFilesList({
          snapshotDir: localBackupSnapshotDir,
          mediaNamesIterator: recordStream.getMediaNamesIterator(),
        });
        const filesRead = await readLocalBackupFilesList(
          localBackupSnapshotDir
        );
        strictAssert(
          isEqual(filesWritten, filesRead),
          'exportBackup: Local backup files proto must match files written'
        );
      }

      const duration = Date.now() - start;
      return { totalBytes, stats: recordStream.getStats(), duration };
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
    await this.refreshBackupAndSubscriptionStatus();
  }

  async #unlinkAndDeleteAllData() {
    window.reduxActions.installer.updateBackupImportProgress({
      error: InstallScreenBackupError.Canceled,
    });

    try {
      await unlinkAccount();
    } catch (e) {
      log.warn(
        'Error while unlinking; this may be expected for the unlink operation',
        Errors.toLogFormat(e)
      );
    }

    try {
      log.info('backups.unlinkAndDeleteAllData: deleting all data');
      await signalProtocolStore.removeAllData();
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

  async #waitForEmptyQueues(
    reason: 'backups.upload' | 'backups.exportLocalBackup'
  ) {
    // Make sure we are up-to-date on storage service
    {
      const { promise: storageService, resolve } = explodePromise<void>();
      window.Whisper.events.once('storageService:syncComplete', resolve);

      runStorageServiceSyncJob({ reason });
      runStorageServiceSyncJob.flush();
      await storageService;
    }

    // Clear message queue
    await window.waitForEmptyEventQueue();

    // Make sure all batches are flushed
    await Promise.all([waitForAllBatchers(), flushAllWaitBatchers()]);
  }

  public isImportRunning(): boolean {
    return this.#isRunning === 'import';
  }
  public isExportRunning(): boolean {
    return this.#isRunning === 'export';
  }

  #getBackupTierFromStorage(): BackupLevel | null {
    const backupTier = itemStorage.get('backupTier');
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

  async #fetchCloudBackupStatus(): Promise<BackupStatusType | undefined> {
    let result: BackupStatusType | undefined;
    const backupProtoInfo = await this.api.getBackupProtoInfo();

    if (backupProtoInfo.backupExists) {
      const { createdAt, size: protoSize } = backupProtoInfo;
      result = {
        createdTimestamp: createdAt.getTime(),
        protoSize,
      };
    }

    await itemStorage.put('cloudBackupStatus', result);
    return result;
  }

  async #fetchSubscriptionStatus(): Promise<
    BackupsSubscriptionType | undefined
  > {
    const cachedBackupSubscriptionStatus = itemStorage.get(
      'backupSubscriptionStatus'
    );
    const backupTier = this.#getBackupTierFromStorage();
    let result: BackupsSubscriptionType | undefined;
    switch (backupTier) {
      case null:
      case undefined:
      case BackupLevel.Free:
        result = { status: 'not-found' };
        break;
      case BackupLevel.Paid:
        await itemStorage.put('backupSubscriptionStatus', {
          ...(cachedBackupSubscriptionStatus ?? { status: 'not-found' }),
          isFetching: true,
        });
        result = await this.api.getSubscriptionInfo();
        break;
      default:
        throw missingCaseError(backupTier);
    }

    await itemStorage.put('backupSubscriptionStatus', {
      ...result,
      lastFetchedAtMs: Date.now(),
      isFetching: false,
    });
    return result;
  }

  async refreshBackupAndSubscriptionStatus(): Promise<void> {
    await Promise.all([
      this.#fetchSubscriptionStatus(),
      this.#fetchCloudBackupStatus(),
    ]);
  }

  async resetCachedData(): Promise<void> {
    this.api.clearCache();
    await this.credentials.clearCache();
    await itemStorage.remove('backupSubscriptionStatus');
    await itemStorage.remove('cloudBackupStatus');
    await this.refreshBackupAndSubscriptionStatus();
  }

  hasMediaBackups(): boolean {
    return itemStorage.get('backupTier') === BackupLevel.Paid;
  }

  getCachedCloudBackupStatus(): BackupStatusType | undefined {
    return itemStorage.get('cloudBackupStatus');
  }

  async pickLocalBackupFolder(): Promise<string | undefined> {
    const { canceled, dirPath: snapshotDir } = await ipcRenderer.invoke(
      'show-open-folder-dialog'
    );
    if (canceled || !snapshotDir) {
      return;
    }

    drop(itemStorage.put('localBackupFolder', snapshotDir));
    return snapshotDir;
  }
}

export const backupsService = new BackupsService();
