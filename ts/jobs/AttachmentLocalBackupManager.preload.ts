// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createWriteStream, existsSync } from 'node:fs';
import { extname } from 'node:path';
import {
  constants as FS_CONSTANTS,
  copyFile,
  mkdir,
  rename,
} from 'node:fs/promises';

import { createLogger } from '../logging/log.std.js';
import {
  getAbsoluteAttachmentPath as doGetAbsoluteAttachmentPath,
  getAbsoluteTempPath as doGetAbsoluteTempPath,
} from '../util/migrations.preload.js';
import { decryptAttachmentV2ToSink } from '../AttachmentCrypto.node.js';
import {
  getLocalBackupDirectoryForMediaName,
  getLocalBackupPathForMediaName,
} from '../services/backups/util/localBackup.node.js';
import { createName } from '../util/attachmentPath.node.js';
import { redactGenericText } from '../util/privacy.node.js';

import type { CoreAttachmentLocalBackupJobType } from '../types/AttachmentBackup.std.js';

const log = createLogger('AttachmentLocalBackupManager');

export class AttachmentPermanentlyMissingError extends Error {}

type RunAttachmentBackupJobDependenciesType = {
  getAbsoluteAttachmentPath: typeof doGetAbsoluteAttachmentPath;
  getAbsoluteTempPath: typeof doGetAbsoluteAttachmentPath;
  decryptAttachmentV2ToSink: typeof decryptAttachmentV2ToSink;
};

export function getJobIdForLogging(
  job: CoreAttachmentLocalBackupJobType
): string {
  return `${redactGenericText(job.mediaName)}`;
}

export async function runAttachmentBackupJob(
  job: CoreAttachmentLocalBackupJobType,
  backupsBaseDir: string,
  dependencies: RunAttachmentBackupJobDependenciesType = {
    getAbsoluteAttachmentPath: doGetAbsoluteAttachmentPath,
    getAbsoluteTempPath: doGetAbsoluteTempPath,
    decryptAttachmentV2ToSink,
  }
): Promise<void> {
  const jobIdForLogging = getJobIdForLogging(job);
  const logId = `AttachmentLocalBackupManager.runAttachmentBackupJob(${jobIdForLogging})`;

  log.info(`${logId}: starting...`);

  const { isPlaintextExport, mediaName } = job;
  const { contentType, fileName, localKey, path, size } = job.data;

  if (!path) {
    throw new AttachmentPermanentlyMissingError('No path property');
  }

  const absolutePath = dependencies.getAbsoluteAttachmentPath(path);
  if (!existsSync(absolutePath)) {
    throw new AttachmentPermanentlyMissingError('No file at provided path');
  }

  const localBackupFileDir = getLocalBackupDirectoryForMediaName({
    backupsBaseDir,
    mediaName,
  });

  await mkdir(localBackupFileDir, { recursive: true });

  const sourceAttachmentPath = dependencies.getAbsoluteAttachmentPath(path);
  const destinationLocalBackupFilePath = getLocalBackupPathForMediaName({
    backupsBaseDir,
    mediaName,
  });

  if (isPlaintextExport) {
    const extension = getExtension(contentType, fileName);
    const outPath = extension
      ? `${destinationLocalBackupFilePath}.${extension}`
      : destinationLocalBackupFilePath;
    const outFileStream = createWriteStream(outPath);
    await dependencies.decryptAttachmentV2ToSink(
      {
        ciphertextPath: sourceAttachmentPath,
        idForLogging: 'AttachmentLocalBackupManager',
        keysBase64: localKey,
        size,
        type: 'local',
      },
      outFileStream
    );
  } else {
    // File is already encrypted with localKey, so we just copy it to the backup dir
    const tempPath = dependencies.getAbsoluteTempPath(createName());

    // A unique constraint on the DB table should enforce that only one job is writing to
    // the same mediaName at a time, but just to be safe, we copy to temp file and rename
    // to ensure the atomicity of the copy operation

    // Set COPYFILE_FICLONE for Copy on Write (OS dependent, graceful fallback to copy)
    await copyFile(
      sourceAttachmentPath,
      tempPath,
      FS_CONSTANTS.COPYFILE_FICLONE
    );
    await rename(tempPath, destinationLocalBackupFilePath);
  }

  log.info(`${logId}: complete!`);
}

function getExtension(
  contentType: string | undefined,
  fileName: string | undefined
): string | undefined {
  if (fileName) {
    const extension = extname(fileName).replace(/^./, '');

    if (extension) {
      return extension;
    }
  }

  if (!contentType) {
    return undefined;
  }

  if (contentType.startsWith('application/x-')) {
    return contentType.replace('application/x-', '');
  }

  if (contentType.startsWith('application/')) {
    return contentType.replace('application/', '');
  }

  if (contentType.startsWith('audio/')) {
    return contentType.replace('audio/', '');
  }

  if (contentType.startsWith('image/')) {
    return contentType.replace('image/', '');
  }

  if (contentType === 'text/x-signal-plain') {
    return 'txt';
  }
  if (contentType.startsWith('text/x-')) {
    return contentType.replace('text/x-', '');
  }

  if (contentType.startsWith('video/')) {
    return contentType.replace('video/', '');
  }

  return undefined;
}
