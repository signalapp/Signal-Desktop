// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { ErrorCode, LibSignalErrorBase } from '@signalapp/libsignal-client';
import {
  isDownloadable,
  isDownloadableFromBackupTier,
  isDownloadableFromTransitTier,
  wasImportedFromLocalBackup,
} from './Attachment.std.ts';
import {
  type AttachmentType,
  AttachmentVariant,
  AttachmentUndownloadableFromTransitTierError,
} from '../types/Attachment.std.ts';
import { downloadAttachment as doDownloadAttachment } from '../textsecure/downloadAttachment.preload.ts';
import {
  getAttachment,
  getAttachmentFromBackupTier,
} from '../textsecure/WebAPI.preload.ts';
import { downloadAttachmentFromLocalBackup as doDownloadAttachmentFromLocalBackup } from './downloadAttachmentFromLocalBackup.preload.ts';
import {
  MediaTier,
  type MessageAttachmentType,
} from '../types/AttachmentDownload.std.ts';
import { createLogger } from '../logging/log.std.ts';
import { HTTPError } from '../types/HTTPError.std.ts';
import { toLogFormat } from '../types/errors.std.ts';
import type { ReencryptedAttachmentV2 } from '../AttachmentCrypto.node.ts';
import * as RemoteConfig from '../RemoteConfig.dom.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import { isAbortError } from './isAbortError.std.ts';
import { expiresTooSoonForBackup } from '../services/backups/util/expiration.std.ts';
import { AttachmentBackfill } from '../jobs/helpers/attachmentBackfill.preload.ts';

const log = createLogger('downloadAttachment');

export async function downloadAttachment({
  attachment,
  options: {
    variant = AttachmentVariant.Default,
    onSizeUpdate,
    abortSignal,
    hasMediaBackups,
    logId: _logId,
    messageExpiresAt,
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
    messageExpiresAt: number | null;
  };
  dependencies?: {
    downloadAttachmentFromServer: typeof doDownloadAttachment;
    downloadAttachmentFromLocalBackup: typeof doDownloadAttachmentFromLocalBackup;
  };
}): Promise<ReencryptedAttachmentV2> {
  const variantForLogging =
    variant !== AttachmentVariant.Default ? `[${variant}]` : '';
  const logId = `${_logId}${variantForLogging}`;

  const canAttemptLocalBackupDownload = wasImportedFromLocalBackup(attachment);
  const canAttemptRemoteBackupDownload = isDownloadableFromBackupTier(
    attachment,
    {
      hasMediaBackups,
    }
  );
  const canAttemptTransitTierDownload =
    isDownloadableFromTransitTier(attachment) &&
    isVariantDownloadableFromTransitTier(variant);

  if (canAttemptLocalBackupDownload) {
    log.info(`${logId}: Downloading attachment from local backup`);
    try {
      const result = await dependencies.downloadAttachmentFromLocalBackup(
        attachment,
        {
          logId,
        }
      );
      onSizeUpdate(attachment.size);
      return result;
    } catch (error) {
      maybeRethrowFatalError(error);

      log.error(
        `${logId}: error when downloading from local backup`,
        toLogFormat(error)
      );
    }
  }

  if (canAttemptRemoteBackupDownload) {
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
      maybeRethrowFatalError(error);

      if (
        RemoteConfig.isEnabled('desktop.internalUser') &&
        !expiresTooSoonForBackup({
          messageExpiresAt,
        })
      ) {
        window.reduxActions.toast.showToast({
          toastType: ToastType.UnableToDownloadFromBackupTier,
        });
      }
    }
  }

  if (canAttemptTransitTierDownload) {
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
      maybeRethrowFatalError(error);

      // Attachments on the transit tier expire after (message queue length + buffer) days,
      // then start returning 404
      if (error instanceof HTTPError && error.code === 404) {
        throw new AttachmentUndownloadableFromTransitTierError(
          `HTTP ${error.code}`
        );
      } else if (
        error instanceof HTTPError &&
        // CDN 0 can return 403 which means the same as 404 from other CDNs
        error.code === 403 &&
        (attachment.cdnNumber == null || attachment.cdnNumber === 0)
      ) {
        throw new AttachmentUndownloadableFromTransitTierError(
          `HTTP ${error.code}`
        );
      } else {
        throw error;
      }
    }
  } else {
    throw new AttachmentUndownloadableFromTransitTierError(
      'Attachment missing required information to download from transit tier'
    );
  }
}

// Some errors should be rethrown and we should avoid fallback download options
function maybeRethrowFatalError(error: unknown) {
  if (isIncrementalMacVerificationError(error)) {
    throw error;
  }

  if (isAbortError(error)) {
    throw error;
  }
}

export function isIncrementalMacVerificationError(error: unknown): boolean {
  return (
    error instanceof LibSignalErrorBase &&
    error.code === ErrorCode.IncrementalMacVerificationFailed
  );
}

export function isBackfillable({
  attachment,
  attachmentType,
  isStory,
}: {
  attachment: AttachmentType;
  attachmentType: MessageAttachmentType;
  isStory: boolean;
}): boolean {
  return AttachmentBackfill.canRequestForAttachment({
    attachment,
    attachmentType,
    isStory,
  });
}

export function isDownloadableOrBackfillable({
  attachment,
  attachmentType,
  isStory,
  hasMediaBackups,
}: {
  attachment: AttachmentType;
  attachmentType: MessageAttachmentType;
  isStory: boolean;
  hasMediaBackups: boolean;
}): boolean {
  return (
    isDownloadable(attachment, { hasMediaBackups }) ||
    isBackfillable({ attachment, attachmentType, isStory })
  );
}

function isVariantDownloadableFromTransitTier(variant: AttachmentVariant) {
  return variant === AttachmentVariant.Default;
}
