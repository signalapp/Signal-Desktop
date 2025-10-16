// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { ErrorCode, LibSignalErrorBase } from '@signalapp/libsignal-client';
import {
  hasRequiredInformationForBackup,
  wasImportedFromLocalBackup,
} from './Attachment.std.js';
import {
  type AttachmentType,
  AttachmentVariant,
  AttachmentPermanentlyUndownloadableError,
} from '../types/Attachment.std.js';
import { downloadAttachment as doDownloadAttachment } from '../textsecure/downloadAttachment.preload.js';
import {
  getAttachment,
  getAttachmentFromBackupTier,
} from '../textsecure/WebAPI.preload.js';
import { downloadAttachmentFromLocalBackup as doDownloadAttachmentFromLocalBackup } from './downloadAttachmentFromLocalBackup.preload.js';
import { MediaTier } from '../types/AttachmentDownload.std.js';
import { createLogger } from '../logging/log.std.js';
import { HTTPError } from '../types/HTTPError.std.js';
import { toLogFormat } from '../types/errors.std.js';
import type { ReencryptedAttachmentV2 } from '../AttachmentCrypto.node.js';
import * as RemoteConfig from '../RemoteConfig.dom.js';
import { ToastType } from '../types/Toast.dom.js';
import { isAbortError } from './isAbortError.std.js';

const log = createLogger('downloadAttachment');

export async function downloadAttachment({
  attachment,
  options: {
    variant = AttachmentVariant.Default,
    onSizeUpdate,
    abortSignal,
    hasMediaBackups,
    logId: _logId,
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
    logId: string;
  };
  dependencies?: {
    downloadAttachmentFromServer: typeof doDownloadAttachment;
    downloadAttachmentFromLocalBackup: typeof doDownloadAttachmentFromLocalBackup;
  };
}): Promise<ReencryptedAttachmentV2> {
  const variantForLogging =
    variant !== AttachmentVariant.Default ? `[${variant}]` : '';
  const logId = `${_logId}${variantForLogging}`;

  const isBackupable = hasRequiredInformationForBackup(attachment);

  const mightBeOnBackupTierNow = isBackupable && hasMediaBackups;
  const mightBeOnBackupTierInTheFuture = isBackupable;

  if (wasImportedFromLocalBackup(attachment)) {
    log.info(`${logId}: Downloading attachment from local backup`);
    try {
      const result = await dependencies.downloadAttachmentFromLocalBackup(
        attachment,
        { logId }
      );
      onSizeUpdate(attachment.size);
      return result;
    } catch (error) {
      if (isIncrementalMacVerificationError(error)) {
        throw error;
      }
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
        {
          getAttachment,
          getAttachmentFromBackupTier,
        },
        { mediaTier: MediaTier.BACKUP, attachment },
        {
          logId,
          onSizeUpdate,
          variant,
          abortSignal,
        }
      );
    } catch (error) {
      if (isIncrementalMacVerificationError(error)) {
        throw error;
      }
      if (isAbortError(error)) {
        throw error;
      }

      const shouldFallbackToTransitTier =
        variant !== AttachmentVariant.ThumbnailFromBackup;

      if (RemoteConfig.isEnabled('desktop.internalUser')) {
        window.reduxActions.toast.showToast({
          toastType: ToastType.UnableToDownloadFromBackupTier,
        });
      }

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
      {
        getAttachment,
        getAttachmentFromBackupTier,
      },
      { attachment, mediaTier: MediaTier.STANDARD },
      {
        logId,
        onSizeUpdate,
        variant,
        abortSignal,
      }
    );
  } catch (error) {
    if (isIncrementalMacVerificationError(error)) {
      throw error;
    }
    if (isAbortError(error)) {
      throw error;
    }

    if (mightBeOnBackupTierInTheFuture) {
      // We don't want to throw the AttachmentPermanentlyUndownloadableError because we
      // may just need to wait for this attachment to end up on the backup tier
      throw error;
    }

    // Attachments on the transit tier expire after (message queue length + buffer) days,
    // then start returning 404
    if (error instanceof HTTPError && error.code === 404) {
      throw new AttachmentPermanentlyUndownloadableError(`HTTP ${error.code}`);
    } else if (
      error instanceof HTTPError &&
      // CDN 0 can return 403 which means the same as 404 from other CDNs
      error.code === 403 &&
      (attachment.cdnNumber == null || attachment.cdnNumber === 0)
    ) {
      throw new AttachmentPermanentlyUndownloadableError(`HTTP ${error.code}`);
    } else {
      throw error;
    }
  }
}

export function isIncrementalMacVerificationError(error: unknown): boolean {
  return (
    error instanceof LibSignalErrorBase &&
    error.code === ErrorCode.IncrementalMacVerificationFailed
  );
}
