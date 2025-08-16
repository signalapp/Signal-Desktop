// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber } from 'lodash';
import { strictAssert } from './assert';

import type { AttachmentType } from '../types/Attachment';

export enum AttachmentDisposition {
  Attachment = 'attachment',
  AvatarData = 'avatarData',
  Draft = 'draft',
  Download = 'download',
  Sticker = 'sticker',
  Temporary = 'temporary',
}

export type GetLocalAttachmentUrlOptionsType = Readonly<{
  disposition?: AttachmentDisposition;
}>;

export function getLocalAttachmentUrl(
  attachment: Partial<
    Pick<
      AttachmentType,
      | 'contentType'
      | 'digest'
      | 'downloadPath'
      | 'incrementalMac'
      | 'chunkSize'
      | 'key'
      | 'localKey'
      | 'path'
      | 'size'
      | 'version'
    >
  >,
  {
    disposition = AttachmentDisposition.Attachment,
  }: GetLocalAttachmentUrlOptionsType = {}
): string {
  let { path } = attachment;

  if (disposition === AttachmentDisposition.Download) {
    strictAssert(
      attachment.incrementalMac && attachment.chunkSize,
      'To view downloads, must have incrementalMac/chunkSize'
    );
    path = attachment.downloadPath;
  }

  strictAssert(path != null, `${disposition} attachment was missing path`);

  // Fix Windows paths
  path = path.replace(/\\/g, '/');

  let url: URL;
  if (disposition === AttachmentDisposition.Download) {
    url = new URL(`attachment://v2/${path}`);
  } else if (attachment.version !== 2) {
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

  if (disposition === AttachmentDisposition.Download) {
    if (!attachment.key) {
      throw new Error('getLocalAttachmentUrl: Missing attachment key!');
    }
    url.searchParams.set('key', attachment.key);

    if (!attachment.digest) {
      throw new Error('getLocalAttachmentUrl: Missing attachment digest!');
    }
    url.searchParams.set('digest', attachment.digest);

    if (!attachment.incrementalMac) {
      throw new Error(
        'getLocalAttachmentUrl: Missing attachment incrementalMac!'
      );
    }
    url.searchParams.set('incrementalMac', attachment.incrementalMac);

    if (!isNumber(attachment.chunkSize)) {
      throw new Error(
        'getLocalAttachmentUrl: Missing attachment incrementalMac!'
      );
    }
    url.searchParams.set('chunkSize', attachment.chunkSize.toString());
  }

  return url.toString();
}
