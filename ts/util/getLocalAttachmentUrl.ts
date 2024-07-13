// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../types/Attachment';
import { strictAssert } from './assert';

export enum AttachmentDisposition {
  Attachment = 'attachment',
  Temporary = 'temporary',
  Draft = 'draft',
  Sticker = 'sticker',
  AvatarData = 'avatarData',
}

export type GetLocalAttachmentUrlOptionsType = Readonly<{
  disposition?: AttachmentDisposition;
}>;

export function getLocalAttachmentUrl(
  attachment: Partial<
    Pick<
      AttachmentType,
      'version' | 'path' | 'localKey' | 'size' | 'contentType'
    >
  >,
  {
    disposition = AttachmentDisposition.Attachment,
  }: GetLocalAttachmentUrlOptionsType = {}
): string {
  strictAssert(attachment.path != null, 'Attachment must be downloaded first');

  // Fix Windows paths
  const path = attachment.path.replace(/\\/g, '/');

  let url: URL;
  if (attachment.version !== 2) {
    url = new URL(`attachment://v1/${path}`);
  } else {
    url = new URL(`attachment://v${attachment.version}/${path}`);
    if (attachment.localKey != null) {
      url.searchParams.set('key', attachment.localKey);
    }
  }

  if (attachment.size != null) {
    url.searchParams.set('size', attachment.size.toString());
  }

  if (attachment.contentType != null) {
    url.searchParams.set('contentType', attachment.contentType);
  }

  if (disposition !== AttachmentDisposition.Attachment) {
    url.searchParams.set('disposition', disposition);
  }
  return url.toString();
}
