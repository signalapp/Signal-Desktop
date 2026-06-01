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
import { exists } from 'fs-extra';

import { getAbsoluteAttachmentPath as doGetAbsoluteAttachmentPath } from '../util/migrations.preload.ts';
import {
  decryptAttachmentV2ToSink,
  safeUnlink,
} from '../AttachmentCrypto.node.ts';
import {
  getLocalBackupDirectoryForMediaName,
  getLocalBackupPathForMediaName,
} from '../services/backups/util/localBackup.node.ts';
import { redactGenericText } from '../util/privacy.node.ts';
import { getRandomBytes } from '../Crypto.node.ts';
import * as Bytes from '../Bytes.std.ts';

import type { CoreAttachmentLocalBackupJobType } from '../types/AttachmentBackup.std.ts';

export class AttachmentPermanentlyMissingError extends Error {}

type RunAttachmentBackupJobDependenciesType = {
  getAbsoluteAttachmentPath: typeof doGetAbsoluteAttachmentPath;
  decryptAttachmentV2ToSink: typeof decryptAttachmentV2ToSink;
};

export function getJobIdForLogging(
  job: CoreAttachmentLocalBackupJobType
): string {
  return redactGenericText(job.mediaName);
}

export async function runAttachmentBackupJob(
  job: CoreAttachmentLocalBackupJobType,
  backupsBaseDir: string,
  dependencies: RunAttachmentBackupJobDependenciesType = {
    getAbsoluteAttachmentPath: doGetAbsoluteAttachmentPath,
    decryptAttachmentV2ToSink,
  }
): Promise<void> {
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
    if (await exists(destinationLocalBackupFilePath)) {
      // File already backed up
      return;
    }

    // File is already encrypted with localKey, so we just copy it to the backup dir.
    // The temp file must be a sibling of the destination so that rename stays on the
    // same filesystem — the backup dir may be on a different partition than the app's
    // temp dir, and rename only works within a single filesystem.
    const tempPath = `${destinationLocalBackupFilePath}.tmp-${Bytes.toHex(getRandomBytes(8))}`;

    try {
      // Set COPYFILE_FICLONE for Copy on Write (OS dependent, graceful fallback to copy)
      await copyFile(
        sourceAttachmentPath,
        tempPath,
        FS_CONSTANTS.COPYFILE_FICLONE
      );
      await rename(tempPath, destinationLocalBackupFilePath);
    } catch (error) {
      await safeUnlink(tempPath);
      throw error;
    }
  }
}

/** @testexport */
export function getExtension(
  contentType: string | undefined,
  fileName: string | undefined
): string | undefined {
  if (fileName) {
    const extension = extname(fileName).replace(/^./, '');

    if (isValidExtension(extension)) {
      return extension;
    }
  }

  if (!contentType) {
    return undefined;
  }

  if (contentType.startsWith('application/x-')) {
    return normalizeExtension(contentType.replace('application/x-', ''));
  }

  if (contentType.startsWith('application/')) {
    return normalizeExtension(contentType.replace('application/', ''));
  }

  if (contentType.startsWith('audio/')) {
    return normalizeExtension(contentType.replace('audio/', ''));
  }

  if (contentType.startsWith('image/')) {
    return normalizeExtension(contentType.replace('image/', ''));
  }

  if (contentType === 'text/x-signal-plain') {
    return 'txt';
  }
  if (contentType.startsWith('text/x-')) {
    return normalizeExtension(contentType.replace('text/x-', ''));
  }

  if (contentType.startsWith('video/')) {
    return normalizeExtension(contentType.replace('video/', ''));
  }

  return undefined;
}

const VALID_EXTENSION_REGEXP = /^[A-Za-z\d](?:[\w+.-]{0,30}[A-Za-z\d])?$/;

function isValidExtension(extension: string): boolean {
  return VALID_EXTENSION_REGEXP.test(extension);
}

function normalizeExtension(extension: string): string | undefined {
  return isValidExtension(extension) ? extension : undefined;
}
