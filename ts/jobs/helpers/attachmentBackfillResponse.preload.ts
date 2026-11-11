// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import lodash from 'lodash';

import type { AttachmentBackfillRequestSyncEventData } from '../../textsecure/messageReceiverEvents.std.ts';
import { MessageSender } from '../../textsecure/SendMessage.preload.ts';
import type { SingleProtoJobData } from '../../textsecure/SendMessage.preload.ts';
import type { MessageModel } from '../../models/messages.preload.ts';
import type { MessageAttributesType } from '../../model-types.std.ts';
import type { AttachmentType } from '../../types/Attachment.std.ts';
import type { LoggerType } from '../../types/Logging.std.ts';

import { SignalService as Proto } from '../../protobuf/index.std.ts';
import { getMessageById } from '../../messages/getMessageById.preload.ts';
import { doAttachmentsOnSameMessageMatch } from '../../util/Attachment.std.ts';
import { copyCdnFields } from '../../util/attachments.preload.ts';
import { isBodyTooLong } from '../../util/longAttachment.std.ts';
import {
  getReusableAttachmentPointer,
  uploadAttachment,
} from '../../util/uploadAttachment.preload.ts';
import { SECOND } from '../../util/durations/index.std.ts';
import * as Errors from '../../types/errors.std.ts';
import { singleProtoJobQueue } from '../singleProtoJobQueue.preload.ts';
import type { Job } from '../Job.std.ts';
import {
  doesAttachmentExist,
  writeNewAttachmentData,
} from '../../util/migrations.preload.ts';
import { isStory } from '../../messages/helpers.std.ts';
import { LONG_MESSAGE, isLongMessage } from '../../types/MIME.std.ts';
import { migrateDataToFileSystem } from '../../util/attachments/migrateDataToFilesystem.std.ts';
import { getExistingAttachmentDataForReuse } from '../../util/attachments/deduplicateAttachment.preload.ts';
import { getPlaintextHashForInMemoryAttachment } from '../../AttachmentCrypto.node.ts';
import { drop } from '../../util/drop.std.ts';
import type { AttachmentBackfillResponseJobData } from '../attachmentBackfillResponseJobQueue.preload.ts';
import { ensureBodyAttachmentsAreSeparated } from '../../util/queueAttachmentDownloads.preload.ts';

type ResponseDataType = NonNullable<
  Proto.SyncMessage.AttachmentBackfillResponse.Params['data']
>;
type AttachmentDataType =
  Proto.SyncMessage.AttachmentBackfillResponse.AttachmentData.Params;

const { throttle } = lodash;

const { Status } = Proto.SyncMessage.AttachmentBackfillResponse.AttachmentData;

// Minimum time between intermediate responses while uploading
const PROGRESS_INTERVAL = 2 * SECOND;

export async function sendAttachmentBackfillResponse(
  { targetMessage, targetConversation }: AttachmentBackfillRequestSyncEventData,
  response: ResponseDataType
): Promise<Job<SingleProtoJobData>> {
  return singleProtoJobQueue.add(
    MessageSender.getAttachmentBackfillResponseSyncMessage(
      targetConversation,
      targetMessage,
      response
    )
  );
}

export const MESSAGE_NOT_FOUND_RESPONSE: ResponseDataType = {
  error: Proto.SyncMessage.AttachmentBackfillResponse.Error.MESSAGE_NOT_FOUND,
};

// Builds a response from the message as it is now
export async function getAttachmentBackfillResponseData(
  message: MessageAttributesType,
  { isFinalResponse }: { isFinalResponse: boolean }
): Promise<{
  response: ResponseDataType;
  attachmentsNeedingUpload: Array<AttachmentType>;
}> {
  const { attachments, longText } = getAttachmentsForBackfill(message);

  const attachmentsNeedingUpload: Array<AttachmentType> = [];
  async function getDataAndUploadStatus(attachment: AttachmentType) {
    const responseData = await getAttachmentResponseData(attachment, {
      isFinalResponse,
    });
    if (responseData.data?.status === Status.PENDING) {
      attachmentsNeedingUpload.push(attachment);
    }
    return responseData;
  }
  return {
    response: {
      attachments: {
        attachments: await Promise.all(attachments.map(getDataAndUploadStatus)),
        longText: longText ? await getDataAndUploadStatus(longText) : null,
      },
    },
    attachmentsNeedingUpload,
  };
}

export async function runAttachmentBackfillResponseJob(
  { messageId, ...target }: AttachmentBackfillResponseJobData,
  {
    isFinalAttempt,
    log,
    upload = uploadAttachment,
  }: {
    isFinalAttempt: boolean;
    log: LoggerType;
    upload?: typeof uploadAttachment;
  }
): Promise<void> {
  const message = await getMessageById(messageId);
  if (message == null) {
    log.info('message not found');
    await sendAttachmentBackfillResponse(target, MESSAGE_NOT_FOUND_RESPONSE);
    return;
  }

  await writeNewBodyAttachmentIfNeeded(message);

  const { response: responseBeforeUpload, attachmentsNeedingUpload } =
    await getAttachmentBackfillResponseData(message.attributes, {
      isFinalResponse: false,
    });

  if (!attachmentsNeedingUpload.length) {
    log.info('No attachments need uploading, sending response');
    await sendAttachmentBackfillResponse(target, responseBeforeUpload);
    return;
  }

  let sendPromiseChain = Promise.resolve();
  const sendProgressUpdate = throttle(
    () => {
      // Ensure that sends go out sequentially
      // oxlint-disable-next-line promise/prefer-await-to-then signal-desktop/no-then
      sendPromiseChain = sendPromiseChain.then(async () => {
        try {
          const { response } = await getAttachmentBackfillResponseData(
            message.attributes,
            { isFinalResponse: false }
          );
          const job = await sendAttachmentBackfillResponse(target, response);
          await job.completion;
        } catch (error) {
          log.warn('failed to send response', Errors.toLogFormat(error));
        }
      });
      return sendPromiseChain;
    },
    PROGRESS_INTERVAL,
    {
      leading: true,
      trailing: true,
    }
  );

  let uploadedCount = 0;
  let failedCount = 0;
  for (const [i, attachment] of attachmentsNeedingUpload.entries()) {
    try {
      // oxlint-disable-next-line no-await-in-loop
      const uploaded = await upload(attachment, {
        allowFileName: true,
      });
      // Save the upload data on the message, so later responses (and sends) can reuse it
      const { updatedCount } = updateAttachmentOnMessage(
        message,
        attachment,
        copyCdnFields(uploaded)
      );
      if (updatedCount === 0) {
        throw new Error('No attachments found to update');
      }

      // oxlint-disable-next-line no-await-in-loop
      await window.MessageCache.saveMessage(message.attributes);
      uploadedCount += 1;
    } catch (error) {
      failedCount += 1;
      log.warn('failed to upload attachment', Errors.toLogFormat(error));
    }

    if (i < attachmentsNeedingUpload.length - 1) {
      drop(sendProgressUpdate());
    }
  }

  sendProgressUpdate.cancel();
  await sendPromiseChain;

  // Send a final response for this run
  const { response } = await getAttachmentBackfillResponseData(
    message.attributes,
    { isFinalResponse: isFinalAttempt }
  );
  await sendAttachmentBackfillResponse(target, response);

  log.info(
    `done; successfulUploads=${uploadedCount} failedUploads=${failedCount}`
  );

  if (failedCount > 0) {
    throw new Error(`Failed to upload ${failedCount} attachments; retrying`);
  }
}

export function getAttachmentsForBackfill(message: MessageAttributesType): {
  attachments: ReadonlyArray<AttachmentType>;
  longText: AttachmentType | null;
} {
  if (
    isStory(message) ||
    message.deletedForEveryone ||
    message.isViewOnce ||
    message.isErased
  ) {
    return { attachments: [], longText: null };
  }

  if (message.sticker?.data != null) {
    return {
      attachments: [message.sticker.data],
      longText: null,
    };
  }

  const { attachments, bodyAttachment } = message;

  return {
    attachments: attachments ?? [],
    longText: bodyAttachment ?? null,
  };
}

async function getAttachmentResponseData(
  attachment: AttachmentType,
  { isFinalResponse }: { isFinalResponse: boolean }
): Promise<AttachmentDataType> {
  const usablePointer = await getReusableAttachmentPointer(attachment, {
    allowFileName: true,
  });
  if (usablePointer) {
    return { data: { attachment: usablePointer } };
  }

  if (await canUpload(attachment)) {
    return {
      data: {
        status: isFinalResponse ? Status.TERMINAL_ERROR : Status.PENDING,
      },
    };
  }

  return { data: { status: Status.TERMINAL_ERROR } };
}

function updateAttachmentOnMessage(
  message: MessageModel,
  attachment: AttachmentType,
  update: Partial<AttachmentType>
): { updatedCount: number } {
  let updatedCount = 0;
  const maybeUpdate = (existing: AttachmentType): AttachmentType => {
    if (doAttachmentsOnSameMessageMatch(existing, attachment)) {
      updatedCount += 1;
      return { ...existing, ...update };
    }

    return existing;
  };

  const { attachments, bodyAttachment, sticker } = message.attributes;

  const changes: Partial<MessageAttributesType> = {
    attachments: attachments?.map(maybeUpdate),
    bodyAttachment: bodyAttachment ? maybeUpdate(bodyAttachment) : undefined,
    sticker: sticker?.data
      ? { ...sticker, data: maybeUpdate(sticker.data) }
      : sticker,
  };

  if (updatedCount > 0) {
    message.set(changes);
  }
  return { updatedCount };
}

async function canUpload(attachment: AttachmentType): Promise<boolean> {
  return (
    attachment.path != null &&
    attachment.localKey != null &&
    (await doesAttachmentExist(attachment.path))
  );
}

// We delete bodyAttachment from disk after download, and historically we removed
// bodyAttachment entirely, so we need to ensure the file still exists, or create a new
// one
export async function writeNewBodyAttachmentIfNeeded(
  message: MessageModel
): Promise<void> {
  // Some legacy messages could still have bodyAttachment on message.attachments
  if (
    message.attributes.attachments?.some(attachment =>
      isLongMessage(attachment.contentType)
    )
  ) {
    message.set(
      ensureBodyAttachmentsAreSeparated(message.attributes, {
        logId: 'writeNewBodyAttachmentIfNeeded',
      })
    );
    await window.MessageCache.saveMessage(message.attributes);
  }

  const { body, bodyAttachment } = message.attributes;

  if (bodyAttachment && (await canUpload(bodyAttachment))) {
    return;
  }

  if (!body || !isBodyTooLong(body)) {
    return;
  }

  const newBodyAttachment = {
    contentType: LONG_MESSAGE,
    size: Buffer.byteLength(body),
  };
  message.set({
    bodyAttachment: {
      ...newBodyAttachment,
      ...(await migrateDataToFileSystem(
        newBodyAttachment,
        Buffer.from(body, 'utf8'),
        {
          writeNewAttachmentData,
          getExistingAttachmentDataForReuse,
          getPlaintextHashForInMemoryAttachment,
        }
      )),
    },
  });
  await window.MessageCache.saveMessage(message.attributes);
}
