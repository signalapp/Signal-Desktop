// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.js';
import type { AttachmentDraftType } from '../types/Attachment.std.js';
import { isVideoAttachment } from './Attachment.std.js';
import {
  getLocalAttachmentUrl,
  AttachmentDisposition,
} from './getLocalAttachmentUrl.std.js';
import { getAbsoluteDraftPath } from './migrations.preload.js';

const log = createLogger('resolveDraftAttachmentOnDisk');

export function resolveDraftAttachmentOnDisk(
  attachment: AttachmentDraftType
): AttachmentDraftType {
  let url = '';
  if (attachment.pending) {
    return attachment;
  }

  if (attachment.screenshotPath) {
    // Legacy
    url = getAbsoluteDraftPath(attachment.screenshotPath);
  } else if (attachment.screenshot?.path) {
    url = getLocalAttachmentUrl(attachment.screenshot, {
      disposition: AttachmentDisposition.Draft,
    });
  } else if (!isVideoAttachment(attachment) && attachment.path) {
    url = getLocalAttachmentUrl(attachment, {
      disposition: AttachmentDisposition.Draft,
    });
  } else {
    log.warn(
      'resolveOnDiskAttachment: Attachment was missing both screenshotPath and path fields'
    );
  }

  const {
    blurHash,
    caption,
    clientUuid,
    contentType,
    fileName,
    flags,
    path,
    size,
    width,
    height,
    version,
    localKey,
  } = attachment;

  return {
    blurHash,
    caption,
    clientUuid,
    contentType,
    fileName,
    flags,
    path,
    size,
    width,
    height,
    version,
    localKey,
    pending: false,
    url,
  };
}
