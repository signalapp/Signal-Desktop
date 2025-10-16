// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createLogger } from '../../../logging/log.std.js';
import * as Bytes from '../../../Bytes.std.js';
import * as Errors from '../../../types/errors.std.js';
import { Signal } from '../../../protobuf/index.std.js';
import protobuf from '../../../protobuf/wrap.std.js';
import { strictAssert } from '../../../util/assert.std.js';
import { decryptAesCtr, encryptAesCtr } from '../../../Crypto.node.js';
import type { LocalBackupMetadataVerificationType } from '../../../types/backups.node.js';
import {
  LOCAL_BACKUP_VERSION,
  LOCAL_BACKUP_BACKUP_ID_IV_LENGTH,
} from '../constants.std.js';
import { explodePromise } from '../../../util/explodePromise.std.js';

const log = createLogger('localBackup');

const { Reader } = protobuf;

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

  return join(backupsBaseDir, 'files', mediaName.substring(0, 2));
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

export async function writeLocalBackupMetadata({
  snapshotDir,
  backupId,
  metadataKey,
}: LocalBackupMetadataVerificationType): Promise<void> {
  const iv = randomBytes(LOCAL_BACKUP_BACKUP_ID_IV_LENGTH);
  const encryptedId = encryptAesCtr(metadataKey, backupId, iv);

  const metadataSerialized = Signal.backup.local.Metadata.encode({
    backupId: new Signal.backup.local.Metadata.EncryptedBackupId({
      iv,
      encryptedId,
    }),
    version: LOCAL_BACKUP_VERSION,
  }).finish();

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

  const localBackupBackupId = decryptAesCtr(metadataKey, encryptedId, iv);
  strictAssert(
    Bytes.areEqual(backupId, localBackupBackupId),
    'verifyLocalBackupMetadata: backupId must match the local backup backupId'
  );

  return true;
}

export async function writeLocalBackupFilesList({
  snapshotDir,
  mediaNamesIterator,
}: {
  snapshotDir: string;
  mediaNamesIterator: MapIterator<string>;
}): Promise<ReadonlyArray<string>> {
  const { promise, resolve, reject } = explodePromise<ReadonlyArray<string>>();

  const filesListPath = join(snapshotDir, 'files');
  const writeStream = createWriteStream(filesListPath);
  writeStream.on('error', error => {
    reject(error);
  });

  const files: Array<string> = [];
  for (const mediaName of mediaNamesIterator) {
    const data = Signal.backup.local.FilesFrame.encodeDelimited({
      mediaName,
    }).finish();
    if (!writeStream.write(data)) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolveStream =>
        writeStream.once('drain', resolveStream)
      );
    }
    files.push(mediaName);
  }

  writeStream.end(() => {
    resolve(files);
  });

  await promise;
  return files;
}

export async function readLocalBackupFilesList(
  snapshotDir: string
): Promise<ReadonlyArray<string>> {
  const filesListPath = join(snapshotDir, 'files');
  const readStream = createReadStream(filesListPath);
  const parseFilesTransform = new ParseFilesListTransform();

  try {
    await pipeline(readStream, parseFilesTransform);
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

  return parseFilesTransform.mediaNames;
}

export class ParseFilesListTransform extends Transform {
  public mediaNames: Array<string> = [];

  public activeFile: Signal.backup.local.FilesFrame | undefined;
  #unused: Uint8Array | undefined;

  override async _transform(
    chunk: Buffer | undefined,
    _encoding: string,
    done: (error?: Error) => void
  ): Promise<void> {
    if (!chunk || chunk.byteLength === 0) {
      done();
      return;
    }

    try {
      let data = chunk;
      if (this.#unused) {
        data = Buffer.concat([this.#unused, data]);
        this.#unused = undefined;
      }

      const reader = Reader.create(data);
      while (reader.pos < reader.len) {
        const startPos = reader.pos;

        if (!this.activeFile) {
          try {
            this.activeFile =
              Signal.backup.local.FilesFrame.decodeDelimited(reader);
          } catch (err) {
            // We get a RangeError if there wasn't enough data to read the next record.
            if (err instanceof RangeError) {
              // Note: A failed decodeDelimited() does in fact update reader.pos, so we
              //   must reset to startPos
              this.#unused = data.subarray(startPos);
              done();
              return;
            }

            // Something deeper has gone wrong; the proto is malformed or something
            done(err);
            return;
          }
        }

        if (!this.activeFile) {
          done(
            new Error(
              'ParseFilesListTransform: No active file after successful decode!'
            )
          );
          return;
        }

        if (this.activeFile.mediaName) {
          this.mediaNames.push(this.activeFile.mediaName);
        } else {
          log.warn(
            'ParseFilesListTransform: Active file had empty mediaName, ignoring'
          );
        }

        this.activeFile = undefined;
      }
    } catch (error) {
      done(error);
      return;
    }

    done();
  }
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
      // eslint-disable-next-line no-await-in-loop
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
