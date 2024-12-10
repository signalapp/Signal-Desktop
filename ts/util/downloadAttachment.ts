// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  type AttachmentType,
  mightBeOnBackupTier,
  AttachmentVariant,
  getAttachmentIdForLogging,
} from '../types/Attachment';
import { downloadAttachment as doDownloadAttachment } from '../textsecure/downloadAttachment';
import { MediaTier } from '../types/AttachmentDownload';
import * as log from '../logging/log';
import { HTTPError } from '../textsecure/Errors';
import { toLogFormat } from '../types/errors';
import type { ReencryptedAttachmentV2 } from '../AttachmentCrypto';

export class AttachmentPermanentlyUndownloadableError extends Error {}

export async function downloadAttachment({
  attachment,
  options: { variant = AttachmentVariant.Default, onSizeUpdate, abortSignal },
  dependencies = { downloadAttachmentFromServer: doDownloadAttachment },
}: {
  attachment: AttachmentType;
  options: {
    variant?: AttachmentVariant;
    onSizeUpdate: (totalBytes: number) => void;
    abortSignal: AbortSignal;
  };
  dependencies?: { downloadAttachmentFromServer: typeof doDownloadAttachment };
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
      if (error instanceof HTTPError && error.code === 404) {
        // This is an expected occurrence if restoring from a backup before the
        // attachment has been moved to the backup tier
        log.warn(`${logId}: attachment not found on backup CDN`);
      } else {
        // We also just log this error instead of throwing, since we want to still try to
        // find it on the attachment tier.
        log.error(
          `${logId}: error when downloading from backup CDN; will try transit tier`,
          toLogFormat(error)
        );
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
    // Attachments on the transit tier expire after 30 days, then start returning 404 or
    // 403
    if (
      error instanceof HTTPError &&
      (error.code === 404 || error.code === 403)
    ) {
      throw new AttachmentPermanentlyUndownloadableError();
    } else {
      throw error;
    }
  }
}
