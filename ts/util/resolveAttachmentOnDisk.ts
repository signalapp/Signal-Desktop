// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { pick } from 'lodash';

import * as log from '../logging/log';
import { AttachmentType } from '../types/Attachment';

export function resolveAttachmentOnDisk(
  attachment: AttachmentType
): AttachmentType {
  let url = '';
  if (attachment.pending) {
    return attachment;
  }

  if (attachment.screenshotPath) {
    url = window.Signal.Migrations.getAbsoluteDraftPath(
      attachment.screenshotPath
    );
  } else if (attachment.path) {
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
      'contentType',
      'fileName',
      'path',
      'size',
    ]),
    pending: false,
    url,
  };
}
