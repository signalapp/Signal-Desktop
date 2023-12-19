// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  AttachmentWithHydratedData,
  UploadedAttachmentType,
} from '../types/Attachment';
import { MIMETypeToString } from '../types/MIME';
import { padAndEncryptAttachment, getRandomBytes } from '../Crypto';
import { strictAssert } from './assert';

export async function uploadAttachment(
  attachment: AttachmentWithHydratedData
): Promise<UploadedAttachmentType> {
  const keys = getRandomBytes(64);
  const encrypted = padAndEncryptAttachment({
    plaintext: attachment.data,
    keys,
  });

  const { server } = window.textsecure;
  strictAssert(server, 'WebAPI must be initialized');

  const cdnKey = await server.putEncryptedAttachment(encrypted.ciphertext);
  const size = attachment.data.byteLength;

  return {
    cdnKey,
    cdnNumber: 2,
    key: keys,
    size,
    digest: encrypted.digest,
    plaintextHash: encrypted.plaintextHash,

    contentType: MIMETypeToString(attachment.contentType),
    fileName: attachment.fileName,
    flags: attachment.flags,
    width: attachment.width,
    height: attachment.height,
    caption: attachment.caption,
    blurHash: attachment.blurHash,
  };
}
