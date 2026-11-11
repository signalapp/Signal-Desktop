// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { pipeline } from 'node:stream/promises';
import { PassThrough } from 'node:stream';
import type { Readable, Writable } from 'node:stream';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm, stat, unlink, writeFile } from 'node:fs/promises';
import fsExtra from 'fs-extra';
import { basename, join } from 'node:path';
import { createGunzip } from 'node:zlib';
import { createCipheriv, createHmac, randomBytes } from 'node:crypto';
import lodash from 'lodash';
import { BackupLevel } from '@signalapp/libsignal-client/zkgroup.js';
import { BackupKey } from '@signalapp/libsignal-client/dist/AccountKeys.js';
import lodashFp from 'lodash/fp.js';
import { ipcRenderer } from 'electron';

import { DataReader, DataWriter } from '../../sql/Client.preload.ts';
import { createLogger } from '../../logging/log.std.ts';
import * as Bytes from '../../Bytes.std.ts';
import { strictAssert } from '../../util/assert.std.ts';
import { drop } from '../../util/drop.std.ts';
import { TEMP_PATH } from '../../util/basePaths.preload.ts';
import { getAbsoluteDownloadsPath } from '../../util/migrations.preload.ts';
import { waitForAllBatchers } from '../../util/batcher.std.ts';
import { flushAllWaitBatchers } from '../../util/waitBatcher.std.ts';
import { DelimitedStream } from '../../util/DelimitedStream.node.ts';
import { prependStream } from '../../util/prependStream.node.ts';
import { appendMacStream } from '../../util/appendMacStream.node.ts';
import { getMacAndUpdateHmac } from '../../util/getMacAndUpdateHmac.node.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { HOUR, SECOND } from '../../util/durations/index.std.ts';
import type { ExplodePromiseResultType } from '../../util/explodePromise.std.ts';
import { explodePromise } from '../../util/explodePromise.std.ts';
import type { ErrorDialogDecision } from '../../state/ducks/installer.preload.ts';
import { CipherType, HashType } from '../../types/Crypto.std.ts';
import {
  InstallScreenBackupStep,
  InstallScreenBackupError,
} from '../../types/InstallScreen.std.ts';
import * as Errors from '../../types/errors.std.ts';
import {
  BackupCredentialType,
  type BackupsSubscriptionType,
  type BackupStatusType,
} from '../../types/backups.node.ts';
import { HTTPError } from '../../types/HTTPError.std.ts';
import { constantTimeEqual } from '../../Crypto.node.ts';
import { measureSize } from '../../AttachmentCrypto.node.ts';
import { signalProtocolStore } from '../../SignalProtocolStore.preload.ts';
import { isTestOrMockEnvironment } from '../../environment.std.ts';
import { runStorageServiceSyncJob } from '../storage.preload.ts';
import { BackupExportStream } from './export.preload.ts';
import { AttachmentBackupManager } from '../../jobs/AttachmentBackupManager.preload.ts';
import { getBackupContentPolicy } from './policy.std.ts';
import type { BackupContentPolicy } from './policy.std.ts';
import { BackupImportStream } from './import.preload.ts';
import {
  toPaddedGzipIterable,
  toDelimitedIterable,
  toJSONIterable,
} from './encoding.node.ts';
import {
  getBackupId,
  getBackupKey,
  getLocalBackupMetadataKey,
  getMessageBackupKey,
} from './crypto.preload.ts';
import { BackupCredentials } from './credentials.preload.ts';
import { BackupAPI } from './api.preload.ts';
import {
  validateBackup,
  _internalValidateBackupIterator,
} from './validator.preload.ts';
import type {
  BackupExportOptions,
  BackupImportOptions,
  ExportResultType,
  LocalBackupExportResultType,
  OnProgressCallback,
} from './types.std.ts';
import {
  BackupInstallerError,
  BackupDownloadFailedError,
  BackupImportCanceledError,
  BackupProcessingError,
  RelinkRequestedError,
} from './errors.std.ts';
import { FileStream } from './util/FileStream.node.ts';
import { ToastType } from '../../types/Toast.dom.tsx';
import { isAdhoc, isNightly } from '../../util/version.std.ts';
import type { ValidateLocalBackupStructureResultType } from './util/localBackup.node.ts';
import {
  writeLocalBackupMetadata,
  verifyLocalBackupMetadata,
  writeLocalBackupFilesList,
  readLocalBackupFilesList,
  pruneLocalBackups,
  validateLocalBackupStructure,
  getLocalBackupFilesDirectory,
  getLocalBackupSnapshotDirectory,
  LOCAL_BACKUP_DIR_NAME,
} from './util/localBackup.node.ts';
import {
  AttachmentPermanentlyMissingError,
  getJobIdForLogging,
  runAttachmentBackupJob,
} from '../../jobs/AttachmentLocalBackupManager.preload.ts';
import { decipherWithAesKey } from '../../util/decipherWithAesKey.node.ts';
import { areRemoteBackupsTurnedOn } from '../../util/isBackupEnabled.preload.ts';
import {
  isOnline,
  unlink as unlinkAccount,
} from '../../textsecure/WebAPI.preload.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';
import { addSensitivePath } from '../../util/privacy.node.ts';
import { LOCAL_BACKUP_VERSION } from './constants.std.ts';
import { getTimestampForFolder } from '../../util/timestamp.std.ts';
import { MEBIBYTE } from '../../types/AttachmentSize.std.ts';
import {
  NotEnoughStorageError,
  RanOutOfStorageError,
  StoragePermissionsError,
} from '../../types/LocalExport.std.ts';
import { getFreeDiskSpace } from '../../util/getFreeDiskSpace.node.ts';
import { Purpose } from '@signalapp/libsignal-client/dist/MessageBackup.js';

const { ensureFile, exists } = fsExtra;

type EncryptedExportEncodingType = {
  type: 'encrypted';
  backupKey: BackupKey;
  purpose: Purpose;
};

type ExportEncodingType =
  | EncryptedExportEncodingType
  | { type: 'plaintext-delimited' | 'plaintext-jsonl' };

const { throttle } = lodashFp;

const { isEqual, noop } = lodash;

const log = createLogger('backupsService');

const IV_LENGTH = 16;

const BACKUP_REFRESH_INTERVAL = 24 * HOUR;

const MIMINUM_DISK_SPACE_FOR_LOCAL_EXPORT = 200 * MEBIBYTE;
const LOCAL_BACKUP_SNAPSHOTS_TO_KEEP = 2;

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
  ephemeralBackupKey: BackupKey | undefined;
  onProgress?: (
    backupStep: InstallScreenBackupStep,
    currentBytes: number,
    totalBytes: number
  ) => void;
}>;

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

  #errorDialogDecision:
    | ExplodePromiseResultType<ErrorDialogDecision>
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

  // Public Export API

  public async exportForRemote({
    path,
    level,
    abortSignal,
  }: {
    path: string;
    level: BackupLevel;
    abortSignal: AbortSignal;
  }): Promise<ExportResultType> {
    strictAssert(
      areRemoteBackupsTurnedOn(),
      'Remote backups must be turned on for a remote export'
    );

    return this.#runExclusiveExport(async () => {
      log.info('exportForRemote: Fetching latest backup CDN metadata');
      await this.fetchAndSaveBackupCdnObjectMetadata();

      const exportResult = await this.#exportEncryptedAndValidate({
        path,
        policy: getBackupContentPolicy({ type: 'remote', level }),
        abortSignal,
        encoding: {
          type: 'encrypted',
          backupKey: getBackupKey(),
          purpose: Purpose.RemoteBackup,
        },
      });

      await this.#replaceRemoteAttachmentBackupQueue(
        level === BackupLevel.Paid ? exportResult.attachmentBackupJobs : []
      );

      return exportResult;
    });
  }

  public async exportForLinkAndSync({
    path,
    ephemeralBackupKey,
    abortSignal,
  }: {
    path: string;
    ephemeralBackupKey: BackupKey;
    abortSignal: AbortSignal;
  }): Promise<ExportResultType> {
    if (isOnline()) {
      await this.#waitForEmptyQueues('backups.exportForLinkAndSync');
    } else {
      log.info('exportForLinkAndSync: offline; skipping wait for empty queues');
    }

    return this.#runExclusiveExport(() =>
      this.#exportEncryptedAndValidate({
        path,
        policy: getBackupContentPolicy({ type: 'link-and-sync' }),
        abortSignal,
        encoding: {
          type: 'encrypted',
          backupKey: ephemeralBackupKey,
          purpose: Purpose.DeviceTransfer,
        },
      })
    );
  }

  public async exportLocalBackup(options: {
    backupsBaseDir: string;
    abortSignal: AbortSignal;
    onProgress: OnProgressCallback;
  }): Promise<LocalBackupExportResultType> {
    const fnLog = log.child('exportLocalBackup');
    fnLog.info('starting...');

    if (isOnline()) {
      await this.#waitForEmptyQueues('backups.exportLocalBackup');
    } else {
      fnLog.info('offline; skipping wait for empty queues');
    }

    // Just in case it's been deleted, ensure the backup dir exists
    await mkdir(options.backupsBaseDir, { recursive: true });

    const freeSpaceBytes = await getFreeDiskSpace(options.backupsBaseDir);
    const bytesNeeded = MIMINUM_DISK_SPACE_FOR_LOCAL_EXPORT - freeSpaceBytes;
    if (bytesNeeded > 0) {
      fnLog.info(
        `Not enough storage; only ${freeSpaceBytes} available, ${MIMINUM_DISK_SPACE_FOR_LOCAL_EXPORT} is minimum needed`
      );
    }

    const filesDir = getLocalBackupFilesDirectory({
      backupsBaseDir: options.backupsBaseDir,
    });

    await mkdir(filesDir, { recursive: true });

    const snapshotDir = getLocalBackupSnapshotDirectory(
      options.backupsBaseDir,
      Date.now()
    );

    if (await exists(snapshotDir)) {
      throw new Error('snapshotDir already exists');
    }

    try {
      await mkdir(snapshotDir, { recursive: true });

      const exportResult = await this.#runExclusiveExport(() =>
        this.#exportEncryptedAndValidate({
          path: join(snapshotDir, 'main'),
          policy: getBackupContentPolicy({ type: 'local-encrypted' }),
          abortSignal: options.abortSignal,
          encoding: {
            type: 'encrypted',
            backupKey: getBackupKey(),
            // libsignal does not have a separate localBackup purpose
            purpose: Purpose.RemoteBackup,
          },
        })
      );

      fnLog.info('writing local backup files list');
      const filesWritten = await writeLocalBackupFilesList({
        snapshotDir,
        mediaNames: exportResult.mediaNames,
      });
      const filesRead = await readLocalBackupFilesList(snapshotDir);
      strictAssert(
        isEqual(filesWritten, filesRead),
        'exportBackup: Local backup files proto must match files written'
      );

      fnLog.info('writing metadata');
      const metadataArgs = {
        snapshotDir,
        backupId: getBackupId(),
        metadataKey: getLocalBackupMetadataKey(),
      };
      await writeLocalBackupMetadata(metadataArgs);
      await verifyLocalBackupMetadata(metadataArgs);

      await this.#runLocalAttachmentBackupJobs({
        attachmentBackupJobs: exportResult.attachmentBackupJobs,
        baseDir: options.backupsBaseDir,
        onProgress: options.onProgress,
        abortSignal: options.abortSignal,
      });

      try {
        await pruneLocalBackups({
          backupsBaseDir: options.backupsBaseDir,
          numSnapshotsToKeep: LOCAL_BACKUP_SNAPSHOTS_TO_KEEP,
        });
      } catch (error) {
        fnLog.warn(
          'failed to prune old local backups',
          Errors.toLogFormat(error)
        );
      }

      return { ...exportResult, snapshotDir };
    } catch (e) {
      if (options.abortSignal.aborted) {
        fnLog.warn('aborted', Errors.toLogFormat(e));
      } else {
        fnLog.error('encountered error', Errors.toLogFormat(e));
      }

      fnLog.info('Deleting just-created snapshot directory');
      await rm(snapshotDir, { recursive: true, force: true });
      fnLog.info('Deleted just-created directory');

      // Prune to remove any files which may have been written before the error occurred
      try {
        await pruneLocalBackups({
          backupsBaseDir: options.backupsBaseDir,
          numSnapshotsToKeep: LOCAL_BACKUP_SNAPSHOTS_TO_KEEP,
        });
      } catch (error) {
        fnLog.warn(
          'failed to prune local backups after export error',
          Errors.toLogFormat(error)
        );
      }

      throw e;
    }
  }

  public async exportPlaintext({
    abortSignal,
    onProgress,
    shouldIncludeMedia,
    targetPath,
  }: {
    abortSignal: AbortSignal;
    onProgress: OnProgressCallback;
    shouldIncludeMedia: boolean;
    targetPath: string;
  }): Promise<LocalBackupExportResultType> {
    let exportDir: string | undefined;
    const fnLog = log.child('exportPlaintext');
    try {
      fnLog.info('starting...');

      const freeSpaceBytes = await getFreeDiskSpace(targetPath);
      const bytesNeeded = MIMINUM_DISK_SPACE_FOR_LOCAL_EXPORT - freeSpaceBytes;
      if (bytesNeeded > 0) {
        fnLog.info(
          `Not enough storage; only ${freeSpaceBytes} available, ${MIMINUM_DISK_SPACE_FOR_LOCAL_EXPORT} is minimum needed`
        );
        throw new NotEnoughStorageError(bytesNeeded);
      }

      exportDir = join(targetPath, `signal-export-${getTimestampForFolder()}`);
      await mkdir(exportDir, { recursive: true });

      if (isOnline()) {
        await this.#waitForEmptyQueues('backups.exportPlaintext');
      } else {
        fnLog.info('offline; skipping wait for empty queues');
      }

      fnLog.info('starting...');

      await mkdir(exportDir, { recursive: true });

      const exportResult = await this.#runExclusiveExport(() => {
        strictAssert(exportDir, 'exists');
        return this.#runExport({
          policy: getBackupContentPolicy({ type: 'plaintext-export' }),
          abortSignal,
          encoding: { type: 'plaintext-jsonl' },
          sink: createWriteStream(join(exportDir, 'main.jsonl')),
        });
      });

      fnLog.info('writing metadata');

      const metadataPath = join(exportDir, 'metadata.json');
      await writeFile(
        metadataPath,
        JSON.stringify({
          version: LOCAL_BACKUP_VERSION,
        })
      );

      if (shouldIncludeMedia) {
        await this.#runLocalAttachmentBackupJobs({
          attachmentBackupJobs: exportResult.attachmentBackupJobs,
          baseDir: exportDir,
          onProgress,
          abortSignal,
        });
      }

      fnLog.info('finished');

      return {
        ...exportResult,
        snapshotDir: exportDir,
      };
    } catch (error) {
      fnLog.warn('encountered error', Errors.toLogFormat(error));
      if (exportDir) {
        fnLog.info('Deleting export directory');
        await rm(exportDir, { recursive: true, force: true });
        fnLog.info('Export directory deleted');
      }

      if (error.code === 'EPERM' || error.code === 'EACCES') {
        throw new StoragePermissionsError();
      }

      throw error;
    }
  }

  public async exportForCrossClientIntegrationTest(): Promise<
    { data: Uint8Array<ArrayBuffer> } & ExportResultType
  > {
    const sink = new PassThrough();

    const chunks = new Array<Uint8Array<ArrayBuffer>>();
    sink.on('data', chunk => chunks.push(chunk));
    const result = await this.#runExclusiveExport(async () => {
      await this.fetchAndSaveBackupCdnObjectMetadata();

      return this.#runExport({
        policy: getBackupContentPolicy({
          type: 'cross-client-integration-test',
          level: BackupLevel.Paid,
        }),
        abortSignal: new AbortController().signal,
        encoding: { type: 'plaintext-delimited' },
        sink,
      });
    });

    return {
      ...result,
      data: Bytes.concatenate(chunks),
    };
  }

  // Public Import API

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

    // oxlint-disable-next-line no-constant-condition
    while (true) {
      try {
        // oxlint-disable-next-line no-await-in-loop
        hasBackup = await this.#doDownloadAndImport({
          downloadPath: absoluteDownloadPath,
          onProgress: options.onProgress,
          ephemeralBackupKey: ephemeralKey
            ? new BackupKey(ephemeralKey)
            : undefined,
        });

        if (!hasBackup) {
          // If the primary cancels sync on their end, then we can link without sync
          log.info('backups.downloadAndImport: missing backup');
          window.reduxActions.installer.handleMissingBackup();
        }
      } catch (error) {
        this.#errorDialogDecision = explodePromise<ErrorDialogDecision>();

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
            : // oxlint-disable-next-line no-await-in-loop
              await this.#errorDialogDecision.promise;
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

        // oxlint-disable-next-line no-await-in-loop
        await this.#unlinkAndDeleteAllData();

        try {
          // oxlint-disable-next-line no-await-in-loop
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

  public retryBackupImport(): void {
    if (!this.#errorDialogDecision) {
      return;
    }

    this.#errorDialogDecision.resolve('retry');
  }

  public cancelDownloadAndImport(): void {
    if (this.#errorDialogDecision) {
      this.#errorDialogDecision.resolve('cancel');
    }

    if (!this.#downloadController && !this.#importController) {
      log.warn('cancelDownloadAndImport: download or import is not running');
      return;
    }

    if (this.#downloadController) {
      log.warn('cancelDownloadAndImport: canceling download');
      this.#downloadController.abort();
      this.#downloadController = undefined;
    }

    if (this.#importController) {
      log.warn('cancelDownloadAndImport: canceling import processing');
      this.#importController.abort();
      this.#importController = undefined;
    }
  }

  public async importFromDisk(
    backupFile: string,
    options: BackupImportOptions
  ): Promise<void> {
    return this.importBackup(() => createReadStream(backupFile), options);
  }

  public async importBackup(
    createBackupStream: () => Readable,
    options: BackupImportOptions
  ): Promise<void> {
    strictAssert(!this.#isRunning, 'BackupService is already running');

    window.IPC.startTrackingQueryStats();

    log.info(`importBackup: starting ${options.type}...`);
    this.#isRunning = 'import';
    const importStart = Date.now();

    await DataWriter.disableMessageInsertTriggers();
    await DataWriter.disableFSync();

    try {
      const controller = new AbortController();

      this.#importController?.abort();
      this.#importController = controller;

      window.ConversationController.setReadOnly(true);

      const importStream = await BackupImportStream.create(options);
      if (
        options.type === 'remote' ||
        options.type === 'local-encrypted' ||
        options.type === 'link-and-sync'
      ) {
        const aci = itemStorage.user.getCheckedAci();

        const backupKey =
          options.type === 'link-and-sync'
            ? options.ephemeralBackupKey
            : getBackupKey();

        const { aesKey, hmacKey } = getMessageBackupKey(backupKey, aci);

        // First pass - don't decrypt, only verify mac
        let hmac = createHmac(HashType.size256, hmacKey);
        let theirMac: Uint8Array<ArrayBuffer> | undefined;
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

        options.onProgress?.(0, totalBytes);

        strictAssert(theirMac != null, 'importBackup: Missing MAC');
        strictAssert(
          constantTimeEqual(hmac.digest(), theirMac),
          'importBackup: Bad MAC'
        );

        // Second pass - decrypt (but still check the mac at the end)
        hmac = createHmac(HashType.size256, hmacKey);

        const progressReporter = new PassThrough();
        progressReporter.pause();

        let currentBytes = 0;
        progressReporter.on('data', chunk => {
          currentBytes += chunk.byteLength;
          options.onProgress?.(currentBytes, totalBytes);
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
      } else if (options.type === 'cross-client-integration-test') {
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
        throw missingCaseError(options.type);
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

  public async stageLocalBackupForImport(
    snapshotDir: string
  ): Promise<ValidateLocalBackupStructureResultType> {
    const result = await validateLocalBackupStructure(snapshotDir);
    const { success, error } = result;
    if (success) {
      this.#localBackupSnapshotDir = snapshotDir;

      if (!isTestOrMockEnvironment()) {
        // Regenerate QR code without link & sync option
        window.reduxActions.installer.startInstaller();

        // oxlint-disable-next-line no-alert
        window.alert(
          'Staged backup successfully. Please link to perform import.'
        );
      }

      log.info(
        `stageLocalBackupForImport: Staged ${snapshotDir} for import. Please link to perform import.`
      );
    } else {
      this.#localBackupSnapshotDir = undefined;
      // oxlint-disable-next-line no-alert
      window.alert(
        'Invalid backup snapshot directory; make sure you choose a snapshot directory (e.g. `signal-backup-2026-01-01-12-00-00`)'
      );
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
      type: 'local-encrypted',
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

  // Public Status API

  public isImportRunning(): boolean {
    return this.#isRunning === 'import';
  }

  public isExportRunning(): boolean {
    return this.#isRunning === 'export';
  }

  public async fetchAndSaveBackupCdnObjectMetadata(): Promise<void> {
    log.info('fetchAndSaveBackupCdnObjectMetadata: clearing existing metadata');
    await DataWriter.clearAllBackupCdnObjectMetadata();

    strictAssert(
      areRemoteBackupsTurnedOn(),
      'Remote backups must be turned on to fetch cdn metadata'
    );

    let cursor: string | undefined;
    const PAGE_SIZE = 1000;
    let numObjects = 0;
    do {
      log.info('fetchAndSaveBackupCdnObjectMetadata: fetching next page');
      // oxlint-disable-next-line no-await-in-loop
      const listResult = await this.api.listMedia({ cursor, limit: PAGE_SIZE });

      // oxlint-disable-next-line no-await-in-loop
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
    const { canceled, dirPath: backupsParentDir } = await ipcRenderer.invoke(
      'show-open-folder-dialog'
    );
    if (canceled || !backupsParentDir) {
      return;
    }

    const localBackupsBaseDir = join(backupsParentDir, LOCAL_BACKUP_DIR_NAME);

    await mkdir(localBackupsBaseDir, { recursive: true });

    await itemStorage.put('localBackupFolder', localBackupsBaseDir);
    addSensitivePath(localBackupsBaseDir);
    return localBackupsBaseDir;
  }

  async disableLocalBackups({
    deleteExistingBackups,
  }: {
    deleteExistingBackups: boolean;
  }): Promise<void> {
    const backupsBaseDir = itemStorage.get('localBackupFolder');

    await Promise.all([
      itemStorage.remove('lastLocalBackup'),
      itemStorage.remove('localBackupFolder'),
      itemStorage.remove('backupKeyViewedHash'),
    ]);

    if (deleteExistingBackups) {
      if (!backupsBaseDir) {
        log.error('disableLocalBackups: backups dir not set');
        return;
      }

      if (basename(backupsBaseDir) !== LOCAL_BACKUP_DIR_NAME) {
        log.warn(
          'disableLocalBackups: backups dir does not have expected name, bailing on deleting backups'
        );
        return;
      }

      await rm(backupsBaseDir, {
        force: true,
        recursive: true,
        maxRetries: 10,
      });
      log.info('disableLocalBackups: deleted backups directory');
    }
  }

  // Test harness
  public async _upload(): Promise<void> {
    await this.#waitForEmptyQueues('backups.upload');

    const fileName = `backup-${randomBytes(32).toString('hex')}`;
    const filePath = join(TEMP_PATH, fileName);

    const backupLevel = await this.credentials.getBackupLevel(
      BackupCredentialType.Media
    );
    log.info(`exportBackup: starting, backup level: ${backupLevel}...`);

    try {
      const { totalBytes } = await this.exportForRemote({
        path: filePath,
        level: backupLevel,
        abortSignal: new AbortController().signal,
      });

      await this.api.upload(filePath, totalBytes);
    } finally {
      try {
        await unlink(filePath);
      } catch {
        // Ignore
      }
    }
  }

  // Test harness
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
    exportOptions: BackupExportOptions = { type: 'local-encrypted' }
  ): Promise<ValidationResultType> {
    try {
      log.info('internal validation: starting');
      const start = Date.now();

      window.IPC.startTrackingQueryStats();
      const exportStream = new BackupExportStream(
        getBackupContentPolicy(exportOptions)
      );

      const { info, iterable } = exportStream.run();

      const totalBytes = await this.#runExclusiveExport(() =>
        _internalValidateBackupIterator(info, iterable)
      );
      window.IPC.stopTrackingQueryStats({
        epochName: 'Internal Validate Backup',
      });

      const duration = Date.now() - start;

      log.info('internal validation: succeeded');
      return {
        result: {
          attachmentBackupJobs: exportStream.getAttachmentBackupJobs(),
          mediaNames: exportStream.getMediaNames(),
          duration,
          stats: exportStream.getStats(),
          totalBytes,
        },
      };
    } catch (error) {
      log.warn(
        'internal validation: failed with errors\n',
        Errors.toLogFormat(error)
      );
      return { error: Errors.toLogFormat(error) };
    }
  }

  // Private Export Helpers

  async #runExclusiveExport<T>(fn: () => Promise<T>): Promise<T> {
    strictAssert(!this.#isRunning, 'BackupService is already running');
    this.#isRunning = 'export';

    try {
      await AttachmentBackupManager.stop();
      try {
        return await fn();
      } finally {
        await AttachmentBackupManager.start();
      }
    } finally {
      this.#isRunning = false;
    }
  }

  async #exportEncryptedAndValidate({
    path,
    policy,
    encoding,
    abortSignal,
  }: {
    path: string;
    policy: BackupContentPolicy;
    encoding: EncryptedExportEncodingType;
    abortSignal: AbortSignal;
  }): Promise<ExportResultType> {
    const exportResult = await this.#runExport({
      policy,
      encoding,
      abortSignal,
      sink: createWriteStream(path),
    });

    await validateBackup(
      () => new FileStream(path),
      exportResult.totalBytes,
      encoding.purpose,
      encoding.backupKey
    );

    return exportResult;
  }

  async #runExport({
    policy,
    encoding,
    sink,
    abortSignal,
  }: {
    policy: BackupContentPolicy;
    encoding: ExportEncodingType;
    sink: Writable;
    abortSignal: AbortSignal;
  }): Promise<ExportResultType> {
    strictAssert(
      this.#isRunning === 'export',
      'exportBackup: must be called from #runExclusiveExport'
    );

    log.info('exportBackup: starting...');

    const start = Date.now();
    window.IPC.startTrackingQueryStats();
    try {
      const exportStream = new BackupExportStream(policy);

      const runOutput = exportStream.run();

      let totalBytes = 0;
      const measure = measureSize({
        onComplete: size => {
          totalBytes = size;
        },
      });

      switch (encoding.type) {
        case 'encrypted': {
          const { aesKey, hmacKey } = getMessageBackupKey(
            encoding.backupKey,
            itemStorage.user.getCheckedAci()
          );
          const iv = randomBytes(IV_LENGTH);
          await pipeline(
            toPaddedGzipIterable(runOutput),
            createCipheriv(CipherType.AES256CBC, aesKey, iv),
            prependStream(iv),
            appendMacStream(hmacKey),
            measure,
            sink,
            { signal: abortSignal }
          );
          break;
        }
        case 'plaintext-delimited':
          strictAssert(
            isTestOrMockEnvironment(),
            'exportBackup: plaintext-delimited export is only for cross-client-integration tests'
          );
          await pipeline(toDelimitedIterable(runOutput), measure, sink, {
            signal: abortSignal,
          });
          break;
        case 'plaintext-jsonl':
          await pipeline(toJSONIterable(runOutput, log), measure, sink, {
            signal: abortSignal,
          });
          break;
        default:
          throw missingCaseError(encoding);
      }

      const duration = Date.now() - start;
      return {
        attachmentBackupJobs: exportStream.getAttachmentBackupJobs(),
        mediaNames: exportStream.getMediaNames(),
        totalBytes,
        stats: exportStream.getStats(),
        duration,
      };
    } finally {
      window.IPC.stopTrackingQueryStats({ epochName: 'Backup Export' });
      log.info('exportBackup: finished...');
    }
  }

  async #replaceRemoteAttachmentBackupQueue(
    jobs: ExportResultType['attachmentBackupJobs']
  ): Promise<void> {
    // TODO (DESKTOP-7344): Clear & add backup jobs in a single transaction
    log.info(`Enqueuing ${jobs.length} remote attachment backup jobs`);
    await DataWriter.clearAllAttachmentBackupJobs();
    await Promise.all(
      jobs.map(job => {
        if (job.type === 'local') {
          log.error(
            "Can't enqueue local backup jobs during remote backup, skipping"
          );
          return Promise.resolve();
        }

        return AttachmentBackupManager.addJobAndMaybeThumbnailJob(job);
      })
    );
  }

  async #runLocalAttachmentBackupJobs({
    attachmentBackupJobs,
    baseDir,
    onProgress,
    abortSignal,
  }: {
    attachmentBackupJobs: ExportResultType['attachmentBackupJobs'];
    baseDir: string;
    onProgress: OnProgressCallback;
    abortSignal: AbortSignal;
  }) {
    let totalAttachmentBytes = 0;
    let currentBytes = 0;

    log.info(
      `runLocalExportAttachmentBackupJobs: About to process ${attachmentBackupJobs.length} jobs`
    );

    for (const job of attachmentBackupJobs) {
      strictAssert(job.type === 'local', 'must be local');
      totalAttachmentBytes += job.data.size;
    }

    const freeSpaceBytes = await getFreeDiskSpace(baseDir);
    const bufferBytes = 100 * MEBIBYTE;
    const bytesNeeded = totalAttachmentBytes + bufferBytes - freeSpaceBytes;

    if (bytesNeeded > 0) {
      log.info(
        `exportLocalBackup: Not enough storage; only ${freeSpaceBytes} available, ${totalAttachmentBytes} of attachments to export`
      );
      throw new NotEnoughStorageError(bytesNeeded);
    }

    for (const job of attachmentBackupJobs) {
      strictAssert(job.type === 'local', 'must be local');

      if (abortSignal.aborted) {
        log.info(
          'exportLocalBackup: Aborted; exiting before processing all attachment jobs'
        );
        throw new Error('User aborted the export!');
      }

      try {
        // oxlint-disable-next-line no-await-in-loop
        await runAttachmentBackupJob(job, baseDir);

        currentBytes += job.data.size;
        onProgress(currentBytes, totalAttachmentBytes);
      } catch (error) {
        if (error instanceof AttachmentPermanentlyMissingError) {
          log.error(
            `${getJobIdForLogging(job)}: Attachment was not found; continuing with export`
          );
          currentBytes += job.data.size;
          continue;
        }

        const stillToExportBytes = totalAttachmentBytes - currentBytes;
        if (error.code === 'ENOSPC') {
          throw new RanOutOfStorageError(stillToExportBytes);
        }
        if (error.code === 'EPERM' || error.code === 'EACCES') {
          throw new StoragePermissionsError();
        }

        throw error;
      }
    }
  }

  // Private Import Helpers

  async #doDownloadAndImport({
    downloadPath,
    ephemeralBackupKey,
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
      if (ephemeralBackupKey == null) {
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

        const onImportProgress = (
          currentBytes: number,
          totalBytes: number
        ): void => {
          onProgress?.(
            InstallScreenBackupStep.Process,
            currentBytes,
            totalBytes
          );
        };

        await this.importFromDisk(
          downloadPath,
          ephemeralBackupKey
            ? {
                type: 'link-and-sync',
                ephemeralBackupKey,
                onProgress: onImportProgress,
              }
            : { type: 'remote', onProgress: onImportProgress }
        );

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

  // Private Helpers

  async #runPeriodicRefresh(): Promise<void> {
    try {
      await this.api.refresh();
      log.info('Backup: refreshed');
    } catch (error) {
      log.error('Backup: periodic refresh failed', Errors.toLogFormat(error));
    }
    await this.refreshBackupAndSubscriptionStatus();
  }

  async #waitForEmptyQueues(
    reason:
      | 'backups.upload'
      | 'backups.exportPlaintext'
      | 'backups.exportLocalBackup'
      | 'backups.exportForLinkAndSync'
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
}

export const backupsService = new BackupsService();

itemStorage.onready(() => {
  const localBackupFolder = itemStorage.get('localBackupFolder');
  if (localBackupFolder) {
    addSensitivePath(localBackupFolder);
  }
});
