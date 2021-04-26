import { isNumber, omit } from 'lodash';
// tslint:disable-next-line: no-submodule-imports
import { default as getGuid } from 'uuid/v4';
import {
  getMessageById,
  getNextAttachmentDownloadJobs,
  removeAttachmentDownloadJob,
  resetAttachmentDownloadPending,
  saveAttachmentDownloadJob,
  saveMessage,
  setAttachmentDownloadJobPending,
} from '../../../ts/data/data';
import { MessageModel } from '../../models/message';
import { downloadAttachment } from '../../receiver/attachments';
import { MessageController } from '../messages';

const MAX_ATTACHMENT_JOB_PARALLELISM = 3;

const SECOND = 1000;
const MINUTE = SECOND * 60;
const HOUR = MINUTE * 60;
const TICK_INTERVAL = MINUTE;

const RETRY_BACKOFF = {
  1: SECOND * 30,
  2: MINUTE * 30,
  3: HOUR * 6,
};

let enabled = false;
let timeout: any;
let logger: any;
const _activeAttachmentDownloadJobs: any = {};

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
    clearTimeout(timeout);
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
    attachment,
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

// tslint:disable: function-name
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

  // To prevent the race condition caused by two parallel database calls, eached kicked
  //   off because the jobCount wasn't at the max.
  const secondJobCount = getActiveJobCount();
  const needed = MAX_ATTACHMENT_JOB_PARALLELISM - secondJobCount;
  if (needed <= 0) {
    return;
  }

  const jobs = nextJobs.slice(0, Math.min(needed, nextJobs.length));
  // tslint:disable: one-variable-per-declaration
  for (let i = 0, max = jobs.length; i < max; i += 1) {
    const job = jobs[i];
    _activeAttachmentDownloadJobs[job.id] = _runJob(job);
  }
}

async function _runJob(job: any) {
  const { id, messageId, attachment, type, index, attempts, isOpenGroupV2 } = job || {};
  let message;

  try {
    if (!job || !attachment || !messageId) {
      throw new Error(`_runJob: Key information required for job was missing. Job id: ${id}`);
    }

    const found = await getMessageById(messageId);
    if (!found) {
      logger.error('_runJob: Source message not found, deleting job');
      await _finishJob(null, id);
      return;
    }
    message = MessageController.getInstance().register(found.id, found);

    const pending = true;
    await setAttachmentDownloadJobPending(id, pending);

    let downloaded;

    try {
      downloaded = await downloadAttachment(attachment);
    } catch (error) {
      // Attachments on the server expire after 60 days, then start returning 404
      if (error && error.code === 404) {
        logger.warn(
          `_runJob: Got 404 from server, marking attachment ${
            attachment.id
          } from message ${message.idForLogging()} as permanent error`
        );

        await _finishJob(message, id);
        await _addAttachmentToMessage(message, _markAttachmentAsError(attachment), { type, index });

        return;
      }
      throw error;
    }

    const upgradedAttachment = await window.Signal.Migrations.processNewAttachment(downloaded);

    await _addAttachmentToMessage(message, upgradedAttachment, { type, index });

    await _finishJob(message, id);
  } catch (error) {
    // tslint:disable: restrict-plus-operands
    const currentAttempt: 1 | 2 | 3 = (attempts || 0) + 1;

    if (currentAttempt >= 3) {
      logger.error(
        `_runJob: ${currentAttempt} failed attempts, marking attachment ${id} from message ${message?.idForLogging()} as permament error:`,
        error && error.stack ? error.stack : error
      );

      await _finishJob(message || null, id);
      await _addAttachmentToMessage(message, _markAttachmentAsError(attachment), { type, index });

      return;
    }

    logger.error(
      `_runJob: Failed to download attachment type ${type} for message ${message?.idForLogging()}, attempt ${currentAttempt}:`,
      error && error.stack ? error.stack : error
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
    await saveMessage(message.attributes);
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
  };
}

// tslint:disable-next-line: cyclomatic-complexity
async function _addAttachmentToMessage(message: any, attachment: any, { type, index }: any) {
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

  if (type === 'contact') {
    const contact = message.get('contact');
    if (!contact || contact.length <= index) {
      throw new Error(`_addAttachmentToMessage: contact didn't exist or ${index} was too large`);
    }
    const item = contact[index];
    if (item && item.avatar && item.avatar.avatar) {
      _replaceAttachment(item.avatar, 'avatar', attachment, logPrefix);
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
      throw new Error(`_addAttachmentToMessage: attachment ${index} was falsey`);
    }
    _replaceAttachment(item, 'thumbnail', attachment, logPrefix);
    return;
  }

  if (type === 'group-avatar') {
    const group = message.get('group');
    if (!group) {
      throw new Error("_addAttachmentToMessage: group didn't exist");
    }

    const existingAvatar = group.avatar;
    if (existingAvatar && existingAvatar.path) {
      await window.Signal.Migrations.deleteAttachmentData(existingAvatar.path);
    }

    _replaceAttachment(group, 'avatar', attachment, logPrefix);
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
