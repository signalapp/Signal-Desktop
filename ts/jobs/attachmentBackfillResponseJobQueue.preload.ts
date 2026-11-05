// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

import type { LoggerType } from '../types/Logging.std.ts';
import { createLogger } from '../logging/log.std.ts';
import type { AttachmentBackfillRequestSyncEvent } from '../textsecure/messageReceiverEvents.std.ts';
import {
  addressableMessageSchema,
  conversationIdentifierSchema,
} from '../textsecure/messageReceiverEvents.std.ts';
import { parseUnknown } from '../util/schemas.std.ts';
import { HOUR } from '../util/durations/index.std.ts';
import { exponentialBackoffMaxAttempts } from '../util/exponentialBackoff.std.ts';
import { commonShouldJobContinue } from './helpers/commonShouldJobContinue.preload.ts';
import {
  MESSAGE_NOT_FOUND_RESPONSE,
  getAttachmentBackfillResponseData,
  getAttachmentsForBackfill,
  runAttachmentBackfillResponseJob,
  sendAttachmentBackfillResponse,
  writeNewBodyAttachmentIfNeeded,
} from './helpers/attachmentBackfillResponse.preload.ts';
import type { JOB_STATUS } from './JobQueue.std.ts';
import { JobQueue } from './JobQueue.std.ts';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore.preload.ts';
import { findMessageFromTarget } from '../util/syncIdentifiers.preload.ts';
import { MessageModel } from '../models/messages.preload.ts';

const log = createLogger('attachmentBackfillResponseJobQueue');

const MAX_ATTEMPTS = exponentialBackoffMaxAttempts(HOUR);

const attachmentBackfillResponseJobDataSchema = z.object({
  messageId: z.string(),
  targetMessage: addressableMessageSchema,
  targetConversation: conversationIdentifierSchema,
});

export type AttachmentBackfillResponseJobData = z.infer<
  typeof attachmentBackfillResponseJobDataSchema
>;

class AttachmentBackfillResponseJobQueue extends JobQueue<AttachmentBackfillResponseJobData> {
  protected parseData(data: unknown): AttachmentBackfillResponseJobData {
    return parseUnknown(attachmentBackfillResponseJobDataSchema, data);
  }

  protected async run(
    { data }: Readonly<{ data: AttachmentBackfillResponseJobData }>,
    { attempt, log: jobLog }: Readonly<{ attempt: number; log: LoggerType }>
  ): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
    const shouldContinue = await commonShouldJobContinue({
      attempt,
      log: jobLog,
      // no deadline, just try up to MAX_ATTEMPTS
      skipWait: false,
    });

    if (!shouldContinue) {
      return;
    }

    await runAttachmentBackfillResponseJob(data, {
      log: jobLog,
      isFinalAttempt: attempt >= MAX_ATTEMPTS,
    });

    return undefined;
  }
}

export const attachmentBackfillResponseJobQueue =
  new AttachmentBackfillResponseJobQueue({
    store: jobQueueDatabaseStore,
    queueType: 'attachment backfill response',
    maxAttempts: MAX_ATTEMPTS,
  });

export async function handleAttachmentBackfillRequest({
  request,
  timestamp,
}: AttachmentBackfillRequestSyncEvent): Promise<void> {
  const logId = `handleAttachmentBackfillRequest(${timestamp})`;

  if (!window.ConversationController.areWePrimaryDevice()) {
    log.info(`${logId}: not primary, dropping`);
    return;
  }

  const attributes = await findMessageFromTarget(request);

  if (!attributes) {
    log.warn(`${logId}: message not found`);
    await sendAttachmentBackfillResponse(request, MESSAGE_NOT_FOUND_RESPONSE);
    return;
  }

  const message = window.MessageCache.register(new MessageModel(attributes));

  await writeNewBodyAttachmentIfNeeded(message);

  const { attachments, longText } = getAttachmentsForBackfill(
    message.attributes
  );

  if (attachments.length === 0 && longText == null) {
    log.warn(`${logId}: message has no backfillable attachments`);
    await sendAttachmentBackfillResponse(request, MESSAGE_NOT_FOUND_RESPONSE);
    return;
  }

  const { response: initialResponse, attachmentsNeedingUpload } =
    await getAttachmentBackfillResponseData(message.attributes, {
      isFinalResponse: false,
    });

  if (attachmentsNeedingUpload.length === 0) {
    log.info(`${logId}: sending completed response`);
    await sendAttachmentBackfillResponse(request, initialResponse);
    return;
  }

  log.info(
    `${logId}: sending initial response and queuing attachment backfill job`
  );
  await sendAttachmentBackfillResponse(request, initialResponse);

  await attachmentBackfillResponseJobQueue.add({
    messageId: message.id,
    targetMessage: request.targetMessage,
    targetConversation: request.targetConversation,
  });
}
