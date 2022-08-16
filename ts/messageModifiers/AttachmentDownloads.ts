// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber, omit } from 'lodash';
import { v4 as getGuid } from 'uuid';

import dataInterface from '../sql/Client';
import * as durations from '../util/durations';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary';
import { strictAssert } from '../util/assert';
import { downloadAttachment } from '../util/downloadAttachment';
import * as Bytes from '../Bytes';
import type {
  AttachmentDownloadJobType,
  AttachmentDownloadJobTypeType,
} from '../sql/Interface';

import type { MessageModel } from '../models/messages';
import type { AttachmentType } from '../types/Attachment';
import * as Errors from '../types/errors';
import type { LoggerType } from '../types/Logging';
import * as log from '../logging/log';

const {
  getMessageById,
  getAttachmentDownloadJobById,
  getNextAttachmentDownloadJobs,
  removeAttachmentDownloadJob,
  resetAttachmentDownloadPending,
  saveAttachmentDownloadJob,
  saveMessage,
  setAttachmentDownloadJobPending,
} = dataInterface;

const MAX_ATTACHMENT_JOB_PARALLELISM = 3;

const TICK_INTERVAL = durations.MINUTE;

const RETRY_BACKOFF: Record<number, number> = {
  1: 30 * durations.SECOND,
  2: 30 * durations.MINUTE,
  3: 6 * durations.HOUR,
};

let enabled = false;
let timeout: NodeJS.Timeout | null;
let logger: LoggerType;
const _activeAttachmentDownloadJobs: Record<string, Promise<void> | undefined> =
  {};

type StartOptionsType = {
  logger: LoggerType;
};

export async function start(options: StartOptionsType): Promise<void> {
  ({ logger } = options);
  if (!logger) {
    throw new Error('attachment_downloads/start: logger must be provided!');
  }

  logger.info('attachment_downloads/start: enabling');
  enabled = true;
  await resetAttachmentDownloadPending();

  _tick();
}

export async function stop(): Promise<void> {
  // If `.start()` wasn't called - the `logger` is `undefined`
  if (logger) {
    logger.info('attachment_downloads/stop: disabling');
  }
  enabled = false;
  clearTimeoutIfNecessary(timeout);
  timeout = null;
}

export async function addJob(
  attachment: AttachmentType,
  job: { messageId: string; type: AttachmentDownloadJobTypeType; index: number }
): Promise<AttachmentType> {
  if (!attachment) {
    throw new Error('attachments_download/addJob: attachment is required');
  }

  const { messageId, type, index } = job;
  if (!messageId) {
    throw new Error('attachments_download/addJob: job.messageId is required');
  }
  if (!type) {
    throw new Error('attachments_download/addJob: job.type is required');
  }
  if (!isNumber(index)) {
    throw new Error('attachments_download/addJob: index must be a number');
  }

  if (attachment.downloadJobId) {
    let existingJob = await getAttachmentDownloadJobById(
      attachment.downloadJobId
    );
    if (existingJob) {
      // Reset job attempts through user's explicit action
      existingJob = { ...existingJob, attempts: 0 };

      if (_activeAttachmentDownloadJobs[existingJob.id]) {
        logger.info(
          `attachment_downloads/addJob: ${existingJob.id} already running`
        );
      } else {
        logger.info(
          `attachment_downloads/addJob: restarting existing job ${existingJob.id}`
        );
        _activeAttachmentDownloadJobs[existingJob.id] = _runJob(existingJob);
      }

      return {
        ...attachment,
        pending: true,
      };
    }
  }

  const id = getGuid();
  const timestamp = Date.now();
  const toSave: AttachmentDownloadJobType = {
    ...job,
    id,
    attachment,
    timestamp,
    pending: 0,
    attempts: 0,
  };

  await saveAttachmentDownloadJob(toSave);

  _maybeStartJob();

  return {
    ...attachment,
    pending: true,
    downloadJobId: id,
  };
}

async function _tick(): Promise<void> {
  clearTimeoutIfNecessary(timeout);
  timeout = null;

  _maybeStartJob();
  timeout = setTimeout(_tick, TICK_INTERVAL);
}

async function _maybeStartJob(): Promise<void> {
  if (!enabled) {
    logger.info('attachment_downloads/_maybeStartJob: not enabled, returning');
    return;
  }

  const jobCount = getActiveJobCount();
  const limit = MAX_ATTACHMENT_JOB_PARALLELISM - jobCount;
  if (limit <= 0) {
    logger.info(
      'attachment_downloads/_maybeStartJob: reached active job limit, waiting'
    );
    return;
  }

  const nextJobs = await getNextAttachmentDownloadJobs(limit);
  if (nextJobs.length <= 0) {
    logger.info(
      'attachment_downloads/_maybeStartJob: no attachment jobs to run'
    );
    return;
  }

  // To prevent the race condition caused by two parallel database calls, eached kicked
  //   off because the jobCount wasn't at the max.
  const secondJobCount = getActiveJobCount();
  const needed = MAX_ATTACHMENT_JOB_PARALLELISM - secondJobCount;
  if (needed <= 0) {
    logger.info(
      'attachment_downloads/_maybeStartJob: reached active job limit after ' +
        'db query, waiting'
    );
    return;
  }

  const jobs = nextJobs.slice(0, Math.min(needed, nextJobs.length));

  logger.info(
    `attachment_downloads/_maybeStartJob: starting ${jobs.length} jobs`
  );

  for (let i = 0, max = jobs.length; i < max; i += 1) {
    const job = jobs[i];
    const existing = _activeAttachmentDownloadJobs[job.id];
    if (existing) {
      logger.warn(
        `attachment_downloads/_maybeStartJob: Job ${job.id} is already running`
      );
    } else {
      logger.info(
        `attachment_downloads/_maybeStartJob: Starting job ${job.id}`
      );
      const promise = _runJob(job);
      _activeAttachmentDownloadJobs[job.id] = promise;

      const postProcess = async () => {
        const logId = `attachment_downloads/_maybeStartJob/postProcess/${job.id}`;
        try {
          await promise;
          if (_activeAttachmentDownloadJobs[job.id]) {
            throw new Error(
              `${logId}: Active attachments jobs list still has this job!`
            );
          }
        } catch (error: unknown) {
          log.error(
            `${logId}: Download job threw an error, deleting.`,
            Errors.toLogFormat(error)
          );

          delete _activeAttachmentDownloadJobs[job.id];
          try {
            await _markAttachmentAsFailed(job);
          } catch (deleteError) {
            log.error(
              `${logId}: Failed to delete attachment job`,
              Errors.toLogFormat(error)
            );
          } finally {
            _maybeStartJob();
          }
        }
      };

      // Note: intentionally not awaiting
      postProcess();
    }
  }
}

async function _runJob(job?: AttachmentDownloadJobType): Promise<void> {
  if (!job) {
    log.warn('attachment_downloads/_runJob: Job was missing!');
    return;
  }

  const { id, messageId, attachment, type, index, attempts } = job;
  let message;

  try {
    if (!job || !attachment || !messageId) {
      throw new Error(
        `_runJob: Key information required for job was missing. Job id: ${id}`
      );
    }

    logger.info(`attachment_downloads/_runJob(${id}): starting`);

    const pending = true;
    await setAttachmentDownloadJobPending(id, pending);

    message = await _getMessageById(id, messageId);

    if (!message) {
      return;
    }

    await _addAttachmentToMessage(
      message,
      { ...attachment, pending: true },
      { type, index }
    );

    const downloaded = await downloadAttachment(attachment);

    if (!downloaded) {
      logger.warn(
        `attachment_downloads/_runJob(${id}): Got 404 from server for CDN ${
          attachment.cdnNumber
        }, marking attachment ${
          attachment.cdnId || attachment.cdnKey
        } from message ${message.idForLogging()} as permanent error`
      );

      await _addAttachmentToMessage(
        message,
        _markAttachmentAsPermanentError(attachment),
        { type, index }
      );
      await _finishJob(message, id);
      return;
    }

    const upgradedAttachment =
      await window.Signal.Migrations.processNewAttachment(downloaded);

    await _addAttachmentToMessage(message, omit(upgradedAttachment, 'error'), {
      type,
      index,
    });

    await _finishJob(message, id);
  } catch (error) {
    const logId = message ? message.idForLogging() : id || '<no id>';
    const currentAttempt = (attempts || 0) + 1;

    if (currentAttempt >= 3) {
      logger.error(
        `attachment_downloads/runJob(${id}): ${currentAttempt} failed ` +
          `attempts, marking attachment from message ${logId} as ` +
          'error:',
        Errors.toLogFormat(error)
      );

      try {
        await _addAttachmentToMessage(
          message,
          _markAttachmentAsTransientError(attachment),
          { type, index }
        );
      } finally {
        await _finishJob(message, id);
      }

      return;
    }

    logger.error(
      `attachment_downloads/_runJob(${id}): Failed to download attachment ` +
        `type ${type} for message ${logId}, attempt ${currentAttempt}:`,
      Errors.toLogFormat(error)
    );

    try {
      // Remove `pending` flag from the attachment.
      await _addAttachmentToMessage(
        message,
        {
          ...attachment,
          downloadJobId: id,
        },
        { type, index }
      );
      if (message) {
        await saveMessage(message.attributes, {
          ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
        });
      }

      const failedJob = {
        ...job,
        pending: 0,
        attempts: currentAttempt,
        timestamp:
          Date.now() + (RETRY_BACKOFF[currentAttempt] || RETRY_BACKOFF[3]),
      };

      await saveAttachmentDownloadJob(failedJob);
    } finally {
      delete _activeAttachmentDownloadJobs[id];
      _maybeStartJob();
    }
  }
}

async function _markAttachmentAsFailed(
  job: AttachmentDownloadJobType
): Promise<void> {
  const { id, messageId, attachment, type, index } = job;
  const message = await _getMessageById(id, messageId);

  if (!message) {
    return;
  }

  await _addAttachmentToMessage(
    message,
    _markAttachmentAsPermanentError(attachment),
    { type, index }
  );
  await _finishJob(message, id);
}

async function _getMessageById(
  id: string,
  messageId: string
): Promise<MessageModel | undefined> {
  const message = window.MessageController.getById(messageId);

  if (message) {
    return message;
  }

  const messageAttributes = await getMessageById(messageId);
  if (!messageAttributes) {
    logger.error(
      `attachment_downloads/_runJob(${id}): ` +
        'Source message not found, deleting job'
    );
    await _finishJob(null, id);
    return;
  }

  strictAssert(messageId === messageAttributes.id, 'message id mismatch');
  return window.MessageController.register(messageId, messageAttributes);
}

async function _finishJob(
  message: MessageModel | null | undefined,
  id: string
): Promise<void> {
  if (message) {
    logger.info(`attachment_downloads/_finishJob for job id: ${id}`);
    await saveMessage(message.attributes, {
      ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
    });
  }

  await removeAttachmentDownloadJob(id);
  delete _activeAttachmentDownloadJobs[id];
  _maybeStartJob();
}

function getActiveJobCount(): number {
  return Object.keys(_activeAttachmentDownloadJobs).length;
}

function _markAttachmentAsPermanentError(
  attachment: AttachmentType
): AttachmentType {
  return {
    ...omit(attachment, ['key', 'digest', 'id']),
    error: true,
  };
}

function _markAttachmentAsTransientError(
  attachment: AttachmentType
): AttachmentType {
  return { ...attachment, error: true };
}

async function _addAttachmentToMessage(
  message: MessageModel | null | undefined,
  attachment: AttachmentType,
  { type, index }: { type: AttachmentDownloadJobTypeType; index: number }
): Promise<void> {
  if (!message) {
    return;
  }

  const logPrefix = `${message.idForLogging()} (type: ${type}, index: ${index})`;

  if (type === 'long-message') {
    // Attachment wasn't downloaded yet.
    if (!attachment.path) {
      message.set({
        bodyAttachment: attachment,
      });
      return;
    }

    try {
      const { data } = await window.Signal.Migrations.loadAttachmentData(
        attachment
      );
      message.set({
        body: Bytes.toString(data),
        bodyAttachment: undefined,
      });
    } finally {
      if (attachment.path) {
        window.Signal.Migrations.deleteAttachmentData(attachment.path);
      }
    }
    return;
  }

  if (type === 'attachment') {
    const attachments = message.get('attachments');
    if (!attachments || attachments.length <= index) {
      throw new Error(
        `_addAttachmentToMessage: attachments didn't exist or ${index} was too large`
      );
    }
    _checkOldAttachment(attachments, index.toString(), logPrefix);

    const newAttachments = [...attachments];
    newAttachments[index] = attachment;

    message.set({ attachments: newAttachments });

    return;
  }

  if (type === 'preview') {
    const preview = message.get('preview');
    if (!preview || preview.length <= index) {
      throw new Error(
        `_addAttachmentToMessage: preview didn't exist or ${index} was too large`
      );
    }
    const item = preview[index];
    if (!item) {
      throw new Error(`_addAttachmentToMessage: preview ${index} was falsey`);
    }

    _checkOldAttachment(item, 'image', logPrefix);

    const newPreview = [...preview];
    newPreview[index] = {
      ...preview[index],
      image: attachment,
    };

    message.set({ preview: newPreview });

    return;
  }

  if (type === 'contact') {
    const contact = message.get('contact');
    if (!contact || contact.length <= index) {
      throw new Error(
        `_addAttachmentToMessage: contact didn't exist or ${index} was too large`
      );
    }
    const item = contact[index];
    if (item && item.avatar && item.avatar.avatar) {
      _checkOldAttachment(item.avatar, 'avatar', logPrefix);

      const newContact = [...contact];
      newContact[index] = {
        ...item,
        avatar: {
          ...item.avatar,
          avatar: attachment,
        },
      };

      message.set({ contact: newContact });
    } else {
      logger.warn(
        `_addAttachmentToMessage: Couldn't update contact with avatar attachment for message ${message.idForLogging()}`
      );
    }

    return;
  }

  if (type === 'quote') {
    const quote = message.get('quote');
    if (!quote) {
      throw new Error("_addAttachmentToMessage: quote didn't exist");
    }
    const { attachments } = quote;
    if (!attachments || attachments.length <= index) {
      throw new Error(
        `_addAttachmentToMessage: quote attachments didn't exist or ${index} was too large`
      );
    }

    const item = attachments[index];
    if (!item) {
      throw new Error(
        `_addAttachmentToMessage: quote attachment ${index} was falsey`
      );
    }

    _checkOldAttachment(item, 'thumbnail', logPrefix);

    const newAttachments = [...attachments];
    newAttachments[index] = {
      ...attachments[index],
      thumbnail: attachment,
    };

    const newQuote = {
      ...quote,
      attachments: newAttachments,
    };

    message.set({ quote: newQuote });

    return;
  }

  if (type === 'sticker') {
    const sticker = message.get('sticker');
    if (!sticker) {
      throw new Error("_addAttachmentToMessage: sticker didn't exist");
    }

    message.set({
      sticker: {
        ...sticker,
        data: attachment,
      },
    });
    return;
  }

  throw new Error(
    `_addAttachmentToMessage: Unknown job type ${type} for message ${message.idForLogging()}`
  );
}

function _checkOldAttachment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  object: any,
  key: string,
  logPrefix: string
): void {
  const oldAttachment = object[key];
  if (oldAttachment && oldAttachment.path) {
    logger.error(
      `_checkOldAttachment: ${logPrefix} - old attachment already had path, not replacing`
    );
    throw new Error(
      '_checkOldAttachment: old attachment already had path, not replacing'
    );
  }
}
