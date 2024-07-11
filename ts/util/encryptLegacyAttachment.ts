// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import LRU from 'lru-cache';
import type {
  AddressableAttachmentType,
  LocalAttachmentV2Type,
} from '../types/Attachment';
import { AttachmentDisposition } from './getLocalAttachmentUrl';

let setCheck = false;

const lru = new LRU<string, Promise<LocalAttachmentV2Type>>({
  max: 1000,
});

export type EncryptLegacyAttachmentOptionsType = Readonly<{
  disposition?: AttachmentDisposition;
  readAttachmentData: (
    attachment: Partial<AddressableAttachmentType>
  ) => Promise<Uint8Array>;
  writeNewAttachmentData: (data: Uint8Array) => Promise<LocalAttachmentV2Type>;
}>;

export async function encryptLegacyAttachment<
  T extends Partial<AddressableAttachmentType>
>(attachment: T, options: EncryptLegacyAttachmentOptionsType): Promise<T> {
  // Not downloaded
  if (!attachment.path) {
    return attachment;
  }

  // Already upgraded
  if (attachment.version === 2) {
    return attachment;
  }

  const { disposition = AttachmentDisposition.Attachment } = options;
  const cacheKey = `${disposition}:${attachment.path}`;

  let promise = lru.get(cacheKey);
  if (!promise) {
    promise = doEncrypt(attachment, options);
    lru.set(cacheKey, promise);
  }
  const modern = await promise;

  return {
    ...attachment,
    ...modern,
  };
}

async function doEncrypt<T extends Partial<AddressableAttachmentType>>(
  attachment: T,
  {
    readAttachmentData,
    writeNewAttachmentData,
  }: EncryptLegacyAttachmentOptionsType
): Promise<LocalAttachmentV2Type> {
  const data = await readAttachmentData(attachment);
  const result = await writeNewAttachmentData(data);

  // Remove fully migrated attachments without references on next startup.
  if (!setCheck) {
    setCheck = true;
    await window.storage.put('needOrphanedAttachmentCheck', true);
  }

  return result;
}
