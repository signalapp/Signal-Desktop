import { filter, isNumber, omit } from 'lodash';
// tslint:disable-next-line: no-submodule-imports
import { default as getGuid } from 'uuid/v4';
import * as Constants from '../constants';
import {
  getMessageById,
  getNextAttachmentDownloadJobs,
  removeAttachmentDownloadJob,
  resetAttachmentDownloadPending,
  saveAttachmentDownloadJob,
  setAttachmentDownloadJobPending,
} from '../../../ts/data/data';
import { MessageModel } from '../../models/message';
import { downloadAttachment, downloadAttachmentOpenGroupV2 } from '../../receiver/attachments';
import { initializeAttachmentLogic, processNewAttachment } from '../../types/MessageAttachment';
import { getAttachmentMetadata } from '../../types/message/initializeAttachmentMetadata';

// this cause issues if we increment that value to > 1.
const MAX_ATTACHMENT_JOB_PARALLELISM = 3;

const TICK_INTERVAL = Constants.DURATION.MINUTES;
// tslint:disable: function-name

const RETRY_BACKOFF = {
  1: Constants.DURATION.SECONDS * 30,
  2: Constants.DURATION.MINUTES * 30,
  3: Constants.DURATION.HOURS * 6,
};

let enabled = false;
let timeout: any;
let logger: any;
const _activeAttachmentDownloadJobs: any = {};

// FIXME audric, type those `any` field

export async function start(options: any = {}) {
  ({ logger } = options);
  if (!logger) {
    throw new Error('attachment_downloads/start: logger must be provided!');
  }

  enabled = true;
  await resetAttachmentDownloadPending();

  void _tick();
}

export function stop() {
  enabled = false;
  if (timeout) {
    global.clearTimeout(timeout);
    timeout = null;
  }
}

export async function addJob(attachment: any, job: any = {}) {
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

  const id = getGuid();
  const timestamp = Date.now();
  const toSave = {
    ...job,
    id,
    attachment: omit(attachment, ['toJSON']), // when addJob is called from the receiver we get an object with a toJSON call we don't care
    timestamp,
    pending: 0,
    attempts: 0,
  };

  await saveAttachmentDownloadJob(toSave);

  void _maybeStartJob();

  return {
    ...attachment,
    pending: true,
    downloadJobId: id,
  };
}

async function _tick() {
  await _maybeStartJob();
  timeout = setTimeout(_tick, TICK_INTERVAL);
}

async function _maybeStartJob() {
  if (!enabled) {
    return;
  }

  const jobCount = getActiveJobCount();
  const limit = MAX_ATTACHMENT_JOB_PARALLELISM - jobCount;
  if (limit <= 0) {
    return;
  }

  const nextJobs = await getNextAttachmentDownloadJobs(limit);
  if (nextJobs.length <= 0) {
    return;
  }

  const nextJobsWithoutCurrentlyRunning = filter(
    nextJobs,
    j => _activeAttachmentDownloadJobs[j.id] === undefined
  );
  if (nextJobsWithoutCurrentlyRunning.length <= 0) {
    return;
  }

  // To prevent the race condition caused by two parallel database calls, eached kicked
  //   off because the jobCount wasn't at the max.
  const secondJobCount = getActiveJobCount();
  const needed = MAX_ATTACHMENT_JOB_PARALLELISM - secondJobCount;
  if (needed <= 0) {
    return;
  }

  const jobs = nextJobsWithoutCurrentlyRunning.slice(
    0,
    Math.min(needed, nextJobsWithoutCurrentlyRunning.length)
  );

  // tslint:disable: one-variable-per-declaration
  for (let i = 0, max = jobs.length; i < max; i += 1) {
    const job = jobs[i];
    _activeAttachmentDownloadJobs[job.id] = _runJob(job);
  }
}

// tslint:disable-next-line: cyclomatic-complexity
async function _runJob(job: any) {
  const { id, messageId, attachment, type, index, attempts, isOpenGroupV2, openGroupV2Details } =
    job || {};
  let found: MessageModel | undefined | null;
  try {
    if (!job || !attachment || !messageId) {
      throw new Error(`_runJob: Key information required for job was missing. Job id: ${id}`);
    }

    found = await getMessageById(messageId);
    if (!found) {
      logger.error('_runJob: Source message not found, deleting job');
      await _finishJob(null, id);
      return;
    }
    const isTrusted = found.isTrustedForAttachmentDownload();

    if (!isTrusted) {
      logger.info('_runJob: sender conversation not trusted yet, deleting job');
      await _finishJob(null, id);
      return;
    }

    if (isOpenGroupV2 && (!openGroupV2Details?.serverUrl || !openGroupV2Details.roomId)) {
      window?.log?.warn(
        'isOpenGroupV2 download attachment, but no valid openGroupV2Details given:',
        openGroupV2Details
      );
      await _finishJob(null, id);
      return;
    }

    const pending = true;
    await setAttachmentDownloadJobPending(id, pending);

    let downloaded;

    try {
      if (isOpenGroupV2) {
        downloaded = await downloadAttachmentOpenGroupV2(attachment, openGroupV2Details);
      } else {
        downloaded = await downloadAttachment(attachment);
      }
    } catch (error) {
      // Attachments on the server expire after 60 days, then start returning 404
      if (error && error.code === 404) {
        logger.warn(
          `_runJob: Got 404 from server, marking attachment ${
            attachment.id
          } from message ${found.idForLogging()} as permanent error`
        );

        await _finishJob(found, id);
        found = await getMessageById(messageId);

        _addAttachmentToMessage(found, _markAttachmentAsError(attachment), { type, index });

        return;
      }
      throw error;
    }

    if (!attachment.contentType) {
      window.log.warn('incoming attachment has no contentType');
    }
    const upgradedAttachment = await processNewAttachment({
      ...downloaded,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
    });
    found = await getMessageById(messageId);
    if (found) {
      const {
        hasAttachments,
        hasVisualMediaAttachments,
        hasFileAttachments,
      } = getAttachmentMetadata(found);
      found.set({ hasAttachments, hasVisualMediaAttachments, hasFileAttachments });
    }

    _addAttachmentToMessage(found, upgradedAttachment, { type, index });

    await _finishJob(found, id);
  } catch (error) {
    // tslint:disable: restrict-plus-operands
    const currentAttempt: 1 | 2 | 3 = (attempts || 0) + 1;

    if (currentAttempt >= 3) {
      logger.error(
        `_runJob: ${currentAttempt} failed attempts, marking attachment ${id} from message ${found?.idForLogging()} as permament error:`,
        error && error.stack ? error.stack : error
      );
      found = await getMessageById(messageId);

      _addAttachmentToMessage(found, _markAttachmentAsError(attachment), { type, index });
      await _finishJob(found || null, id);

      return;
    }

    logger.error(
      `_runJob: Failed to download attachment type ${type} for message ${found?.idForLogging()}, attempt ${currentAttempt}:`,
      error && error.message ? error.message : error
    );

    const failedJob = {
      ...job,
      pending: 0,
      attempts: currentAttempt,
      timestamp: Date.now() + RETRY_BACKOFF[currentAttempt],
    };

    await saveAttachmentDownloadJob(failedJob);
    // tslint:disable-next-line: no-dynamic-delete
    delete _activeAttachmentDownloadJobs[id];
    void _maybeStartJob();
  }
}

async function _finishJob(message: MessageModel | null, id: string) {
  if (message) {
    const conversation = message.getConversation();
    if (conversation) {
      await message.commit();
    }
  }

  await removeAttachmentDownloadJob(id);
  // tslint:disable-next-line: no-dynamic-delete
  delete _activeAttachmentDownloadJobs[id];
  await _maybeStartJob();
}

function getActiveJobCount() {
  return Object.keys(_activeAttachmentDownloadJobs).length;
}

function _markAttachmentAsError(attachment: any) {
  return {
    ...omit(attachment, ['key', 'digest', 'id']),
    error: true,
    pending: false,
  };
}

// tslint:disable-next-line: cyclomatic-complexity
function _addAttachmentToMessage(
  message: MessageModel | null | undefined,
  attachment: any,
  { type, index }: any
) {
  if (!message) {
    return;
  }

  const logPrefix = `${message.idForLogging()} (type: ${type}, index: ${index})`;

  if (type === 'attachment') {
    const attachments = message.get('attachments');
    if (!attachments || attachments.length <= index) {
      throw new Error(
        `_addAttachmentToMessage: attachments didn't exist or ${index} was too large`
      );
    }
    _replaceAttachment(attachments, index, attachment, logPrefix);

    return;
  }

  if (type === 'preview') {
    const preview = message.get('preview');
    if (!preview || preview.length <= index) {
      throw new Error(`_addAttachmentToMessage: preview didn't exist or ${index} was too large`);
    }
    const item = preview[index];
    if (!item) {
      throw new Error(`_addAttachmentToMessage: preview ${index} was falsey`);
    }
    _replaceAttachment(item, 'image', attachment, logPrefix);
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
      throw new Error(`_addAttachmentToMessage: attachment ${index} was falsey`);
    }
    _replaceAttachment(item, 'thumbnail', attachment, logPrefix);

    return;
  }

  throw new Error(
    `_addAttachmentToMessage: Unknown job type ${type} for message ${message.idForLogging()}`
  );
}

function _replaceAttachment(object: any, key: any, newAttachment: any, logPrefix: any) {
  const oldAttachment = object[key];
  if (oldAttachment && oldAttachment.path) {
    logger.warn(
      `_replaceAttachment: ${logPrefix} - old attachment already had path, not replacing`
    );
  }

  // eslint-disable-next-line no-param-reassign
  object[key] = newAttachment;
}

export const initAttachmentPaths = initializeAttachmentLogic;
