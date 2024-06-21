// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { pick } from 'lodash';

import * as log from '../logging/log';
import type { AttachmentDraftType } from '../types/Attachment';
import { isVideoAttachment } from '../types/Attachment';

export function resolveDraftAttachmentOnDisk(
  attachment: AttachmentDraftType
): AttachmentDraftType {
  let url = '';
  if (attachment.pending) {
    return attachment;
  }

  if (attachment.screenshotPath) {
    url = window.Signal.Migrations.getAbsoluteDraftPath(
      attachment.screenshotPath
    );
  } else if (!isVideoAttachment(attachment) && attachment.path) {
    url = window.Signal.Migrations.getAbsoluteDraftPath(attachment.path);
  } else {
    log.warn(
      'resolveOnDiskAttachment: Attachment was missing both screenshotPath and path fields'
    );
  }
  return {
    ...pick(attachment, [
      'blurHash',
      'caption',
      'clientUuid',
      'contentType',
      'fileName',
      'flags',
      'path',
      'size',
      'width',
      'height',
    ]),
    pending: false,
    url,
  };
}
