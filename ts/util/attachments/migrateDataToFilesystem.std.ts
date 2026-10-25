// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../../types/Attachment.std.ts';
import type { ContextType } from '../../types/Message2.preload.ts';

export async function migrateDataToFileSystem(
  attachment: AttachmentType,
  data: Uint8Array<ArrayBuffer>,
  {
    writeNewAttachmentData,
    getExistingAttachmentDataForReuse,
    getPlaintextHashForInMemoryAttachment,
  }: Pick<
    ContextType,
    | 'writeNewAttachmentData'
    | 'getExistingAttachmentDataForReuse'
    | 'getPlaintextHashForInMemoryAttachment'
  >
): Promise<AttachmentType> {
  const plaintextHash = getPlaintextHashForInMemoryAttachment(data);

  const existingData = await getExistingAttachmentDataForReuse({
    plaintextHash,
    contentType: attachment.contentType,
    logId: 'migrateDataToFileSystem',
  });

  if (existingData) {
    return {
      ...attachment,
      plaintextHash,
      ...existingData,
    };
  }

  const newAttachmentData = await writeNewAttachmentData(data);
  return { ...attachment, ...newAttachmentData };
}
