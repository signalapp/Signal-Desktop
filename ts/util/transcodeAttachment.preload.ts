// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { sanitize } from '@signalapp/libsignal-client/dist/Mp4Sanitizer.js';

import { toLogFormat } from '../types/errors.std.ts';
import type { LoggerType } from '../types/Logging.std.ts';
import type { MessageModel } from '../models/messages.preload.ts';
import type {
  AttachmentType,
  AttachmentWithHydratedData,
} from '../types/Attachment.std.ts';
import { DataWriter } from '../sql/Client.preload.ts';
import { MemoryStream } from './MemoryStream.node.ts';
import {
  loadAttachmentData,
  writeNewAttachmentData,
  maybeDeleteAttachmentFile,
} from './migrations.preload.ts';
import { updateAttachment } from './editHelpers.std.ts';
import { strictAssert } from './assert.std.ts';
import { isVideoTypeSupported } from './GoogleChrome.std.ts';

export async function transcodeAttachment({
  log,
  attachment,
  message,
  targetTimestamp,
}: {
  log: LoggerType;
  attachment: AttachmentType;
  message: MessageModel;
  targetTimestamp: number;
}): Promise<{
  attachment: AttachmentType;
  withData: AttachmentWithHydratedData;
}> {
  const withData = await loadAttachmentData(attachment);

  const { transcodingTargetQuality } = withData;
  if (transcodingTargetQuality == null) {
    return { attachment, withData };
  }

  let { data } = withData;
  if (isVideoTypeSupported(attachment.contentType)) {
    log.info('running mp4san');

    try {
      const result = await sanitize(
        new MemoryStream(data),
        BigInt(data.byteLength)
      );
      const metadata = result.getMetadata();

      // If there is no metadata - mp4 is already in the fast state!
      if (metadata != null) {
        const dataLen = Number(result.getDataLen());
        const dataOffset = Number(result.getDataOffset());
        const sanitized = new Uint8Array(dataLen + metadata.byteLength);
        sanitized.set(metadata, 0);
        sanitized.set(
          data.subarray(dataOffset, dataOffset + dataLen),
          metadata.byteLength
        );

        data = sanitized;
      }
    } catch (error) {
      log.warn(`Failed to mp4san video ${toLogFormat(error)}`);
    }
  }

  let attachmentUpdate: Partial<AttachmentType>;
  if (data === withData.data) {
    attachmentUpdate = {
      transcodingTargetQuality: undefined,
    };
  } else {
    // Write new attachment
    const draftFields = await writeNewAttachmentData(data);

    attachmentUpdate = {
      ...draftFields,
      transcodingTargetQuality: undefined,
    };
  }

  const { messageUpdate, newAttachment } = updateAttachment({
    log,
    message: message.attributes,
    targetTimestamp,
    oldAttachment: attachment,
    attachmentUpdate,
  });

  if (messageUpdate) {
    log.info('saving transcoded attachment');
    message.set(messageUpdate);

    // Save message after transcoding the attachment
    await window.MessageCache.saveMessage(message.attributes);
  }

  // Release reuseToken if given to us
  if (withData.reuseToken != null) {
    await DataWriter.releaseAttachmentPathProtections(attachment);
  }

  // Delete old attachment if it is not referenced by other message
  strictAssert(withData.path != null, 'Must have old path');
  await maybeDeleteAttachmentFile(withData.path);

  return {
    attachment: newAttachment,
    withData: {
      ...newAttachment,
      data,
      size: data.byteLength,
    },
  };
}
