// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isFunction, isTypedArray, isUndefined, omit } from 'lodash';
import type {
  AttachmentType,
  LocalAttachmentV2Type,
} from '../../types/Attachment';
import type { LoggerType } from '../../types/Logging';

export async function migrateDataToFileSystem(
  attachment: AttachmentType,
  {
    writeNewAttachmentData,
    logger,
  }: {
    writeNewAttachmentData: (
      data: Uint8Array
    ) => Promise<LocalAttachmentV2Type>;
    logger: LoggerType;
  }
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

  const local = await writeNewAttachmentData(data);

  const attachmentWithoutData = omit({ ...attachment, ...local }, ['data']);
  return attachmentWithoutData;
}
