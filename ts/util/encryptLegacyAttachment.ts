// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { LRUCache } from 'lru-cache';

import type {
  AddressableAttachmentType,
  LocalAttachmentV2Type,
} from '../types/Attachment';
import * as log from '../logging/log';
import { DataWriter } from '../sql/Client';
import { AttachmentDisposition } from './getLocalAttachmentUrl';
import { drop } from './drop';
import { MINUTE } from './durations';

let setCheck = false;
let orphanedCount = 0;
let cleanupTimeout: NodeJS.Timeout | undefined;

// Max number of orphaned attachments before we schedule a cleanup.
const MAX_ORPHANED_COUNT = 10000;

const lru = new LRUCache<string, Promise<LocalAttachmentV2Type>>({
  max: 1000,
});

export type EncryptLegacyAttachmentOptionsType = Readonly<{
  logId: string;
  disposition?: AttachmentDisposition;
  readAttachmentData: (
    attachment: Partial<AddressableAttachmentType>
  ) => Promise<Uint8Array>;
  writeNewAttachmentData: (data: Uint8Array) => Promise<LocalAttachmentV2Type>;
}>;

export async function encryptLegacyAttachment<
  T extends Partial<AddressableAttachmentType>,
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
  try {
    const modern = await promise;

    return {
      ...attachment,
      ...modern,
    };
  } catch (error) {
    const { logId } = options;
    log.error(`${logId}: migration failed, falling back to original`, error);
    return attachment;
  }
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

  orphanedCount += 1;

  // Remove fully migrated attachments without references on next startup.
  if (orphanedCount > MAX_ORPHANED_COUNT) {
    log.error('encryptLegacyAttachment: too many orphaned, cleanup now');
    if (cleanupTimeout !== undefined) {
      clearTimeout(cleanupTimeout);
      cleanupTimeout = undefined;
    }
    cleanup();
  } else if (!setCheck) {
    setCheck = true;
    await window.storage.put('needOrphanedAttachmentCheck', true);
    log.error('encryptLegacyAttachment: scheduling orphaned cleanup');
    cleanupTimeout = setTimeout(cleanup, 15 * MINUTE);
  }

  return result;
}

function cleanup(): void {
  log.error('encryptLegacyAttachment: running orphaned cleanup');

  cleanupTimeout = undefined;
  setCheck = false;
  orphanedCount = 0;
  drop(window.storage.remove('needOrphanedAttachmentCheck'));
  drop(DataWriter.cleanupOrphanedAttachments());
}
