// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber, omit } from 'lodash';

import { strictAssert } from '../util/assert';
import { dropNull } from '../util/dropNull';
import type { DownloadedAttachmentType } from '../types/Attachment';
import * as MIME from '../types/MIME';
import * as Bytes from '../Bytes';
import { getFirstBytes, decryptAttachment } from '../Crypto';

import type { ProcessedAttachment } from './Types.d';
import type { WebAPIType } from './WebAPI';

export async function downloadAttachment(
  server: WebAPIType,
  attachment: ProcessedAttachment
): Promise<DownloadedAttachmentType> {
  const cdnId = attachment.cdnId || attachment.cdnKey;
  const { cdnNumber } = attachment;

  if (!cdnId) {
    throw new Error('downloadAttachment: Attachment was missing cdnId!');
  }

  strictAssert(cdnId, 'attachment without cdnId');
  const encrypted = await server.getAttachment(cdnId, dropNull(cdnNumber));
  const { key, digest, size, contentType } = attachment;

  if (!digest) {
    throw new Error('Failure: Ask sender to update Signal and resend.');
  }

  strictAssert(key, 'attachment has no key');
  strictAssert(digest, 'attachment has no digest');

  const paddedData = decryptAttachment(
    encrypted,
    Bytes.fromBase64(key),
    Bytes.fromBase64(digest)
  );

  if (!isNumber(size)) {
    throw new Error(
      `downloadAttachment: Size was not provided, actual size was ${paddedData.byteLength}`
    );
  }

  const data = getFirstBytes(paddedData, size);

  return {
    ...omit(attachment, 'digest', 'key'),

    size,
    contentType: contentType
      ? MIME.stringToMIMEType(contentType)
      : MIME.APPLICATION_OCTET_STREAM,
    data,
  };
}
