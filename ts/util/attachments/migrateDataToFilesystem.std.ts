// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import type { AttachmentType } from '../../types/Attachment.std.js';
import type { ContextType } from '../../types/Message2.preload.js';
import type { MessageAttributesType } from '../../model-types.js';

const { isFunction, isTypedArray, isUndefined, omit } = lodash;

export async function migrateDataToFileSystem(
  attachment: AttachmentType,
  {
    writeNewAttachmentData,
    getExistingAttachmentDataForReuse,
    getPlaintextHashForInMemoryAttachment,
    logger,
  }: Pick<
    ContextType,
    | 'writeNewAttachmentData'
    | 'getExistingAttachmentDataForReuse'
    | 'getPlaintextHashForInMemoryAttachment'
    | 'logger'
  >,
  message: Pick<MessageAttributesType, 'id'>
): Promise<AttachmentType> {
  if (!isFunction(writeNewAttachmentData)) {
    throw new TypeError("'writeNewAttachmentData' must be a function");
  }

  const { data } = attachment;
  const attachmentHasData = !isUndefined(data);
  const shouldSkipSchemaUpgrade = !attachmentHasData;

  if (shouldSkipSchemaUpgrade) {
    return attachment;
  }

  // This attachment was already broken by a roundtrip to the database - repair it now
  if (!isTypedArray(data)) {
    logger.warn(
      'migrateDataToFileSystem: Attachment had non-array `data` field; deleting.'
    );
    return omit({ ...attachment }, ['data']);
  }

  const plaintextHash = getPlaintextHashForInMemoryAttachment(data);

  const existingData = await getExistingAttachmentDataForReuse({
    plaintextHash,
    messageId: message.id,
    contentType: attachment.contentType,
    logId: 'migrateDataToFileSystem',
  });
  const attachmentWithoutData = omit(attachment, ['data']);

  if (existingData) {
    return {
      ...attachmentWithoutData,
      plaintextHash,
      ...existingData,
    };
  }

  const newAttachmentData = await writeNewAttachmentData(data);
  return { ...attachmentWithoutData, ...newAttachmentData };
}
