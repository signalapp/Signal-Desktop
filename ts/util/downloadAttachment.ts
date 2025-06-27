// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  type AttachmentType,
  AttachmentVariant,
  AttachmentPermanentlyUndownloadableError,
  getAttachmentIdForLogging,
  hasRequiredInformationForBackup,
  wasImportedFromLocalBackup,
} from '../types/Attachment';
import { downloadAttachment as doDownloadAttachment } from '../textsecure/downloadAttachment';
import { downloadAttachmentFromLocalBackup as doDownloadAttachmentFromLocalBackup } from './downloadAttachmentFromLocalBackup';
import { MediaTier } from '../types/AttachmentDownload';
import { createLogger } from '../logging/log';
import { HTTPError } from '../textsecure/Errors';
import { toLogFormat } from '../types/errors';
import type { ReencryptedAttachmentV2 } from '../AttachmentCrypto';

const log = createLogger('downloadAttachment');

export async function downloadAttachment({
  attachment,
  options: {
    variant = AttachmentVariant.Default,
    onSizeUpdate,
    abortSignal,
    hasMediaBackups,
  },
  dependencies = {
    downloadAttachmentFromServer: doDownloadAttachment,
    downloadAttachmentFromLocalBackup: doDownloadAttachmentFromLocalBackup,
  },
}: {
  attachment: AttachmentType;
  options: {
    variant?: AttachmentVariant;
    onSizeUpdate: (totalBytes: number) => void;
    abortSignal: AbortSignal;
    hasMediaBackups: boolean;
  };
  dependencies?: {
    downloadAttachmentFromServer: typeof doDownloadAttachment;
    downloadAttachmentFromLocalBackup: typeof doDownloadAttachmentFromLocalBackup;
  };
}): Promise<ReencryptedAttachmentV2> {
  const attachmentId = getAttachmentIdForLogging(attachment);
  const variantForLogging =
    variant !== AttachmentVariant.Default ? `[${variant}]` : '';
  const dataId = `${attachmentId}${variantForLogging}`;
  const logId = `downloadAttachmentUtil(${dataId})`;

  const { server } = window.textsecure;
  if (!server) {
    throw new Error('window.textsecure.server is not available!');
  }

  const isBackupable = hasRequiredInformationForBackup(attachment);

  const mightBeOnBackupTierNow = isBackupable && hasMediaBackups;
  const mightBeOnBackupTierInTheFuture = isBackupable;

  if (wasImportedFromLocalBackup(attachment)) {
    log.info(`${logId}: Downloading attachment from local backup`);
    try {
      const result =
        await dependencies.downloadAttachmentFromLocalBackup(attachment);
      onSizeUpdate(attachment.size);
      return result;
    } catch (error) {
      // We also just log this error instead of throwing, since we want to still try to
      // find it on the backup then transit tiers.
      log.error(
        `${logId}: error when downloading from local backup; will try backup and transit tier`,
        toLogFormat(error)
      );
    }
  }

  if (mightBeOnBackupTierNow) {
    try {
      return await dependencies.downloadAttachmentFromServer(
        server,
        { mediaTier: MediaTier.BACKUP, attachment },
        {
          logPrefix: dataId,
          onSizeUpdate,
          variant,
          abortSignal,
        }
      );
    } catch (error) {
      const shouldFallbackToTransitTier =
        variant !== AttachmentVariant.ThumbnailFromBackup;

      if (error instanceof HTTPError && error.code === 404) {
        // This is an expected occurrence if restoring from a backup before the
        // attachment has been moved to the backup tier
        log.warn(
          `${logId}: attachment not found on backup CDN`,
          shouldFallbackToTransitTier ? 'will try transit tier' : ''
        );
      } else {
        // We also just log this error instead of throwing, since we want to still try to
        // find it on the attachment tier.
        log.error(
          `${logId}: error when downloading from backup CDN`,
          shouldFallbackToTransitTier ? 'will try transit tier' : '',
          toLogFormat(error)
        );
      }

      if (!shouldFallbackToTransitTier) {
        throw error;
      }
    }
  }

  try {
    return await dependencies.downloadAttachmentFromServer(
      server,
      { attachment, mediaTier: MediaTier.STANDARD },
      {
        logPrefix: dataId,
        onSizeUpdate,
        variant,
        abortSignal,
      }
    );
  } catch (error) {
    if (mightBeOnBackupTierInTheFuture) {
      // We don't want to throw the AttachmentPermanentlyUndownloadableError because we
      // may just need to wait for this attachment to end up on the backup tier
      throw error;
    }

    // Attachments on the transit tier expire after (message queue length + buffer) days,
    // then start returning 404
    if (error instanceof HTTPError && error.code === 404) {
      throw new AttachmentPermanentlyUndownloadableError(`HTTP ${error.code}`);
    } else {
      throw error;
    }
  }
}
