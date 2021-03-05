/* global Signal, setTimeout, clearTimeout, getMessageController, NewReceiver, models */

const { isNumber, omit } = require('lodash');
const getGuid = require('uuid/v4');
const {
  getMessageById,
  getNextAttachmentDownloadJobs,
  removeAttachmentDownloadJob,
  resetAttachmentDownloadPending,
  saveAttachmentDownloadJob,
  saveMessage,
  setAttachmentDownloadJobPending,
} = require('../../ts/data/data');
const { stringFromBytes } = require('./crypto');

module.exports = {
  start,
  stop,
  addJob,
};

const MAX_ATTACHMENT_JOB_PARALLELISM = 3;

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const TICK_INTERVAL = MINUTE;

const RETRY_BACKOFF = {
  1: 30 * SECOND,
  2: 30 * MINUTE,
  3: 6 * HOUR,
};

let enabled = false;
let timeout;
let logger;
const _activeAttachmentDownloadJobs = {};

async function start(options = {}) {
  ({ logger } = options);
  if (!logger) {
    throw new Error('attachment_downloads/start: logger must be provided!');
  }

  enabled = true;
  await resetAttachmentDownloadPending();

  _tick();
}

async function stop() {
  enabled = false;
  if (timeout) {
    clearTimeout(timeout);
    timeout = null;
  }
}

async function addJob(attachment, job = {}) {
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

  _maybeStartJob();

  return {
    ...attachment,
    pending: true,
    downloadJobId: id,
  };
}

async function _tick() {
  _maybeStartJob();
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
  for (let i = 0, max = jobs.length; i < max; i += 1) {
    const job = jobs[i];
    _activeAttachmentDownloadJobs[job.id] = _runJob(job);
  }
}

async function _runJob(job) {
  const { id, messageId, attachment, type, index, attempts } = job || {};
  let message;

  try {
    if (!job || !attachment || !messageId) {
      throw new Error(
        `_runJob: Key information required for job was missing. Job id: ${id}`
      );
    }

    const found = await getMessageById(messageId);
    if (!found) {
      logger.error('_runJob: Source message not found, deleting job');
      await _finishJob(null, id);
      return;
    }
    message = getMessageController().register(found.id, found);

    const pending = true;
    await setAttachmentDownloadJobPending(id, pending);

    let downloaded;

    try {
      downloaded = await NewReceiver.downloadAttachment(attachment);
    } catch (error) {
      // Attachments on the server expire after 30 days, then start returning 404
      if (error && error.code === 404) {
        logger.warn(
          `_runJob: Got 404 from server, marking attachment ${
            attachment.id
          } from message ${message.idForLogging()} as permanent error`
        );

        await _finishJob(message, id);
        await _addAttachmentToMessage(
          message,
          _markAttachmentAsError(attachment),
          { type, index }
        );

        return;
      }
      throw error;
    }

    const upgradedAttachment = await Signal.Migrations.processNewAttachment(
      downloaded
    );

    await _addAttachmentToMessage(message, upgradedAttachment, { type, index });

    await _finishJob(message, id);
  } catch (error) {
    const currentAttempt = (attempts || 0) + 1;

    if (currentAttempt >= 3) {
      logger.error(
        `_runJob: ${currentAttempt} failed attempts, marking attachment ${id} from message ${message.idForLogging()} as permament error:`,
        error && error.stack ? error.stack : error
      );

      await _finishJob(message, id);
      await _addAttachmentToMessage(
        message,
        _markAttachmentAsError(attachment),
        { type, index }
      );

      return;
    }

    logger.error(
      `_runJob: Failed to download attachment type ${type} for message ${message.idForLogging()}, attempt ${currentAttempt}:`,
      error && error.stack ? error.stack : error
    );

    const failedJob = {
      ...job,
      pending: 0,
      attempts: currentAttempt,
      timestamp: Date.now() + RETRY_BACKOFF[currentAttempt],
    };

    await saveAttachmentDownloadJob(failedJob);
    delete _activeAttachmentDownloadJobs[id];
    _maybeStartJob();
  }
}

async function _finishJob(message, id) {
  if (message) {
    await saveMessage(message.attributes);
    const conversation = message.getConversation();
    if (conversation) {
      message.commit();
    }
  }

  await removeAttachmentDownloadJob(id);
  delete _activeAttachmentDownloadJobs[id];
  _maybeStartJob();
}

function getActiveJobCount() {
  return Object.keys(_activeAttachmentDownloadJobs).length;
}

function _markAttachmentAsError(attachment) {
  return {
    ...omit(attachment, ['key', 'digest', 'id']),
    error: true,
  };
}

async function _addAttachmentToMessage(message, attachment, { type, index }) {
  if (!message) {
    return;
  }

  const logPrefix = `${message.idForLogging()} (type: ${type}, index: ${index})`;

  if (type === 'long-message') {
    try {
      const { data } = await Signal.Migrations.loadAttachmentData(attachment);
      message.set({
        body: attachment.isError ? message.get('body') : stringFromBytes(data),
      });
    } finally {
      Signal.Migrations.deleteAttachmentData(attachment.path);
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
    _replaceAttachment(attachments, index, attachment, logPrefix);
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
    _replaceAttachment(item, 'image', attachment, logPrefix);
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
      throw new Error(
        `_addAttachmentToMessage: attachment ${index} was falsey`
      );
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
      await Signal.Migrations.deleteAttachmentData(existingAvatar.path);
    }

    _replaceAttachment(group, 'avatar', attachment, logPrefix);
    return;
  }

  throw new Error(
    `_addAttachmentToMessage: Unknown job type ${type} for message ${message.idForLogging()}`
  );
}

function _replaceAttachment(object, key, newAttachment, logPrefix) {
  const oldAttachment = object[key];
  if (oldAttachment && oldAttachment.path) {
    logger.warn(
      `_replaceAttachment: ${logPrefix} - old attachment already had path, not replacing`
    );
  }

  // eslint-disable-next-line no-param-reassign
  object[key] = newAttachment;
}
