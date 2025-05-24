// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  type AttachmentType,
  mightBeOnBackupTier,
  AttachmentVariant,
  AttachmentPermanentlyUndownloadableError,
  getAttachmentIdForLogging,
  mightBeInLocalBackup,
} from '../types/Attachment';
import { downloadAttachment as doDownloadAttachment } from '../textsecure/downloadAttachment';
import { downloadAttachmentFromLocalBackup as doDownloadAttachmentFromLocalBackup } from './downloadAttachmentFromLocalBackup';
import { MediaTier } from '../types/AttachmentDownload';
import * as log from '../logging/log';
import { HTTPError } from '../textsecure/Errors';
import { toLogFormat } from '../types/errors';
import type { ReencryptedAttachmentV2 } from '../AttachmentCrypto';

export async function downloadAttachment({
  attachment,
  options: { variant = AttachmentVariant.Default, onSizeUpdate, abortSignal },
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

  let migratedAttachment: AttachmentType;

  const { id: legacyId } = attachment;
  if (legacyId === undefined) {
    migratedAttachment = attachment;
  } else {
    migratedAttachment = {
      ...attachment,
      cdnId: String(legacyId),
    };
  }

  if (mightBeInLocalBackup(attachment)) {
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

  if (mightBeOnBackupTier(migratedAttachment)) {
    try {
      return await dependencies.downloadAttachmentFromServer(
        server,
        migratedAttachment,
        {
          logPrefix: dataId,
          mediaTier: MediaTier.BACKUP,
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
      migratedAttachment,
      {
        logPrefix: dataId,
        mediaTier: MediaTier.STANDARD,
        onSizeUpdate,
        variant,
        abortSignal,
      }
    );
  } catch (error) {
    if (mightBeOnBackupTier(migratedAttachment)) {
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
