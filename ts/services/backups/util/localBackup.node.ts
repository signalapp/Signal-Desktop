// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { randomBytes } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createLogger } from '../../../logging/log.std.ts';
import * as Bytes from '../../../Bytes.std.ts';
import * as Errors from '../../../types/errors.std.ts';
import { Signal } from '../../../protobuf/index.std.ts';
import { DelimitedStream } from '../../../util/DelimitedStream.node.ts';
import { strictAssert } from '../../../util/assert.std.ts';
import { encodeDelimited } from '../../../util/encodeDelimited.std.ts';
import { decryptAesCtr, encryptAesCtr } from '../../../Crypto.node.ts';
import type { LocalBackupMetadataVerificationType } from '../../../types/backups.node.ts';
import {
  LOCAL_BACKUP_VERSION,
  LOCAL_BACKUP_BACKUP_ID_IV_LENGTH,
} from '../constants.std.ts';
import { getTimestampForFolder } from '../../../util/timestamp.std.ts';
import { isPathInside } from '../../../util/isPathInside.node.ts';

const log = createLogger('localBackup');

const LOCAL_BACKUP_SNAPSHOT_DIR_PREFIX = 'signal-backup-';
const LOCAL_BACKUP_SNAPSHOT_DIR_PATTERN =
  /^signal-backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/;

export const LOCAL_BACKUP_DIR_NAME = 'SignalBackups';

export function getLocalBackupSnapshotDirectory(
  backupsBaseDir: string,
  timestamp: number
): string {
  return join(
    backupsBaseDir,
    `${LOCAL_BACKUP_SNAPSHOT_DIR_PREFIX}${getTimestampForFolder(timestamp)}`
  );
}

export function getLocalBackupFilesDirectory({
  backupsBaseDir,
}: {
  backupsBaseDir: string;
}): string {
  return join(backupsBaseDir, 'files');
}

export async function getAllPathsInLocalBackupFilesDirectory({
  backupsBaseDir,
}: {
  backupsBaseDir: string;
}): Promise<Array<string>> {
  const filesDir = getLocalBackupFilesDirectory({ backupsBaseDir });
  const allEntries = await readdir(filesDir, {
    withFileTypes: true,
    recursive: true,
  }).catch(error => {
    // Be resilient to files folder not exist
    if ('code' in error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  });

  return allEntries
    .filter(entry => entry.isFile())
    .map(entry => join(entry.parentPath, entry.name));
}

async function getSortedLocalBackupSnapshotDirs({
  backupsBaseDir,
}: {
  backupsBaseDir: string;
}): Promise<Array<string>> {
  const entries = await readdir(backupsBaseDir, { withFileTypes: true });
  const snapshotDirs = new Array<string>();

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (!entry.name.startsWith(LOCAL_BACKUP_SNAPSHOT_DIR_PREFIX)) {
      continue;
    }

    if (LOCAL_BACKUP_SNAPSHOT_DIR_PATTERN.test(entry.name)) {
      snapshotDirs.push(join(backupsBaseDir, entry.name));
    }
  }

  return snapshotDirs.sort().reverse();
}

export async function pruneLocalBackups({
  backupsBaseDir,
  numSnapshotsToKeep,
}: {
  backupsBaseDir: string;
  numSnapshotsToKeep: number;
}): Promise<void> {
  const fnLog = log.child('pruneLocalBackups');

  const snapshotDirs = await getSortedLocalBackupSnapshotDirs({
    backupsBaseDir,
  });

  const snapshotDirsToKeep = snapshotDirs.slice(0, numSnapshotsToKeep);
  const snapshotDirsToDelete = snapshotDirs.slice(numSnapshotsToKeep);

  if (snapshotDirsToDelete.length > 0) {
    if (snapshotDirsToDelete.length === 1) {
      fnLog.info('pruning one snapshot');
    } else {
      fnLog.warn(`pruning ${snapshotDirsToDelete.length} snapshots`);
    }

    await Promise.all(
      snapshotDirsToDelete.map(snapshotDir => {
        strictAssert(
          isPathInside(snapshotDir, backupsBaseDir),
          'ensure snapshot dir inside backups dir'
        );
        return rm(snapshotDir, { recursive: true, force: true });
      })
    );
  }

  const referencedMediaNames = new Set<string>();
  for (const snapshotDir of snapshotDirsToKeep) {
    // oxlint-disable-next-line no-await-in-loop
    const mediaNames = await readLocalBackupFilesList(snapshotDir);
    for (const mediaName of mediaNames) {
      referencedMediaNames.add(mediaName);
    }
  }

  const allMediaPaths = await getAllPathsInLocalBackupFilesDirectory({
    backupsBaseDir,
  });

  const mediaPathsToDelete = allMediaPaths.filter(
    mediaPath => !referencedMediaNames.has(basename(mediaPath))
  );

  if (mediaPathsToDelete.length > 0) {
    fnLog.info(
      `Deleting ${mediaPathsToDelete.length} files no longer referenced`
    );
    const filesDirectory = getLocalBackupFilesDirectory({ backupsBaseDir });
    await Promise.all(
      mediaPathsToDelete.map(mediaPath => {
        strictAssert(
          isPathInside(mediaPath, filesDirectory),
          'ensure mediaPath inside backup files dir'
        );
        return rm(mediaPath, { force: true });
      })
    );
  }
}

export function getLocalBackupDirectoryForMediaName({
  backupsBaseDir,
  mediaName,
}: {
  backupsBaseDir: string;
  mediaName: string;
}): string {
  if (mediaName.length < 2) {
    throw new Error('Invalid mediaName input');
  }

  return join(
    getLocalBackupFilesDirectory({ backupsBaseDir }),
    mediaName.substring(0, 2)
  );
}

export function getLocalBackupPathForMediaName({
  backupsBaseDir,
  mediaName,
}: {
  backupsBaseDir: string;
  mediaName: string;
}): string {
  return join(
    getLocalBackupDirectoryForMediaName({ backupsBaseDir, mediaName }),
    mediaName
  );
}

/**
 * Given a target local backup import e.g. /etc/SignalBackups/signal-backup-1743119037066
 * and an attachment, return the attachment's file path within the local backup
 * e.g. /etc/SignalBackups/files/a1/[a1bcdef...]
 *
 * @param {string} snapshotDir - Timestamped local backup directory
 */
export function getAttachmentLocalBackupPathFromSnapshotDir(
  mediaName: string,
  snapshotDir: string
): string {
  return join(
    dirname(snapshotDir),
    'files',
    mediaName.substring(0, 2),
    mediaName
  );
}

function getBackupIdIvAndCounter({
  iv,
}: {
  iv: Uint8Array<ArrayBuffer>;
}): Uint8Array<ArrayBuffer> {
  return Buffer.concat([iv, Buffer.alloc(4)]);
}

export async function writeLocalBackupMetadata({
  snapshotDir,
  backupId,
  metadataKey,
}: LocalBackupMetadataVerificationType): Promise<void> {
  const iv = randomBytes(LOCAL_BACKUP_BACKUP_ID_IV_LENGTH);
  const encryptedId = encryptAesCtr(
    metadataKey,
    backupId,
    getBackupIdIvAndCounter({ iv })
  );

  const metadataSerialized = Signal.backup.local.Metadata.encode({
    backupId: {
      iv,
      encryptedId,
    },
    version: LOCAL_BACKUP_VERSION,
  });

  const metadataPath = join(snapshotDir, 'metadata');
  await writeFile(metadataPath, metadataSerialized);
}

export async function verifyLocalBackupMetadata({
  snapshotDir,
  backupId,
  metadataKey,
}: LocalBackupMetadataVerificationType): Promise<boolean> {
  const metadataPath = join(snapshotDir, 'metadata');
  const metadataSerialized = await readFile(metadataPath);

  const metadata = Signal.backup.local.Metadata.decode(metadataSerialized);
  strictAssert(
    metadata.version === LOCAL_BACKUP_VERSION,
    'verifyLocalBackupMetadata: Local backup version must match'
  );
  strictAssert(
    metadata.backupId,
    'verifyLocalBackupMetadata: Must have backupId'
  );

  const { iv, encryptedId } = metadata.backupId;
  strictAssert(iv, 'verifyLocalBackupMetadata: Must have backupId.iv');
  strictAssert(
    encryptedId,
    'verifyLocalBackupMetadata: Must have backupId.encryptedId'
  );

  const localBackupBackupId = decryptAesCtr(
    metadataKey,
    encryptedId,
    getBackupIdIvAndCounter({ iv })
  );
  strictAssert(
    Bytes.areEqual(backupId, localBackupBackupId),
    'verifyLocalBackupMetadata: backupId must match the local backup backupId'
  );

  return true;
}

export async function writeLocalBackupFilesList({
  snapshotDir,
  mediaNames,
}: {
  snapshotDir: string;
  mediaNames: Array<string>;
}): Promise<ReadonlyArray<string>> {
  const filesListPath = join(snapshotDir, 'files');
  const writeStream = createWriteStream(filesListPath);

  const files: Array<string> = [];

  function* generateFrames() {
    for (const mediaName of mediaNames) {
      const data = Signal.backup.local.FilesFrame.encode({
        item: {
          mediaName,
        },
      });

      yield* encodeDelimited(data);

      files.push(mediaName);
    }
  }

  const frameGenerator = Readable.from(generateFrames());

  await pipeline(frameGenerator, writeStream);
  return files;
}

export async function readLocalBackupFilesList(
  snapshotDir: string
): Promise<ReadonlyArray<string>> {
  const filesListPath = join(snapshotDir, 'files');
  const readStream = createReadStream(filesListPath);
  const delimitedStream = new DelimitedStream();

  const mediaNames = new Array<string>();
  const parseFilesWritable = new Writable({
    objectMode: true,
    write(data, _enc, callback) {
      try {
        const file = Signal.backup.local.FilesFrame.decode(data);
        if (file.item?.mediaName) {
          mediaNames.push(file.item.mediaName);
        } else {
          log.warn(
            'ParseFilesListTransform: Active file had empty mediaName, ignoring'
          );
        }
        callback(null);
      } catch (error) {
        callback(error);
      }
    },
  });

  try {
    await pipeline(readStream, delimitedStream, parseFilesWritable);
  } catch (error) {
    try {
      readStream.close();
    } catch (closeError) {
      log.error(
        'readLocalBackupFilesList: Error when closing readStream',
        Errors.toLogFormat(closeError)
      );
    }

    throw error;
  }

  readStream.close();

  return mediaNames;
}

export type ValidateLocalBackupStructureResultType =
  | { success: true; error: undefined; snapshotDir: string | undefined }
  | { success: false; error: string; snapshotDir: string | undefined };

export async function validateLocalBackupStructure(
  snapshotDir: string
): Promise<ValidateLocalBackupStructureResultType> {
  try {
    await stat(snapshotDir);
  } catch (error) {
    return {
      success: false,
      error: 'Snapshot directory does not exist',
      snapshotDir,
    };
  }

  for (const file of ['main', 'metadata', 'files']) {
    try {
      // oxlint-disable-next-line no-await-in-loop
      await stat(join(snapshotDir, 'main'));
    } catch (error) {
      return {
        success: false,
        error: `Snapshot directory does not contain ${file} file`,
        snapshotDir,
      };
    }
  }

  return { success: true, error: undefined, snapshotDir };
}
