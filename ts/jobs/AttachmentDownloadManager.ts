// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { omit } from 'lodash';

import { drop } from '../util/drop';
import * as durations from '../util/durations';
import { missingCaseError } from '../util/missingCaseError';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary';
import * as log from '../logging/log';
import {
  type AttachmentDownloadJobTypeType,
  type AttachmentDownloadJobType,
  attachmentDownloadJobSchema,
} from '../types/AttachmentDownload';
import {
  AttachmentNotFoundOnCdnError,
  downloadAttachment,
} from '../util/downloadAttachment';
import dataInterface from '../sql/Client';
import { getValue } from '../RemoteConfig';

import {
  explodePromise,
  type ExplodePromiseResultType,
} from '../util/explodePromise';
import { isInCall as isInCallSelector } from '../state/selectors/calling';
import {
  type ExponentialBackoffOptionsType,
  exponentialBackoffSleepTime,
} from '../util/exponentialBackoff';
import { AttachmentSizeError, type AttachmentType } from '../types/Attachment';
import { __DEPRECATED$getMessageById } from '../messages/getMessageById';
import type { MessageModel } from '../models/messages';
import {
  KIBIBYTE,
  getMaximumIncomingAttachmentSizeInKb,
  getMaximumIncomingTextAttachmentSizeInKb,
} from '../types/AttachmentSize';
import { addAttachmentToMessage } from '../messageModifiers/AttachmentDownloads';
import * as Errors from '../types/errors';
import { redactGenericText } from '../util/privacy';

export enum AttachmentDownloadUrgency {
  IMMEDIATE = 'immediate',
  STANDARD = 'standard',
}

const TICK_INTERVAL = durations.MINUTE;
const MAX_CONCURRENT_JOBS = 3;

type AttachmentDownloadJobIdentifiersType = Pick<
  AttachmentDownloadJobType,
  'messageId' | 'attachmentType' | 'digest'
>;

// Type for adding a new job
export type NewAttachmentDownloadJobType = {
  attachment: AttachmentType;
  messageId: string;
  receivedAt: number;
  sentAt: number;
  attachmentType: AttachmentDownloadJobTypeType;
  urgency?: AttachmentDownloadUrgency;
};

const RETRY_CONFIG: Record<
  'default',
  { maxRetries: number; backoffConfig: ExponentialBackoffOptionsType }
> = {
  default: {
    maxRetries: 4,
    backoffConfig: {
      // 30 seconds, 5 minutes, 50 minutes, (max) 6 hrs
      multiplier: 10,
      firstBackoffTime: 30 * durations.SECOND,
      maxBackoffTime: 6 * durations.HOUR,
    },
  },
};

type AttachmentDownloadManagerParamsType = {
  getNextJobs: (options: {
    limit: number;
    prioritizeMessageIds?: Array<string>;
    timestamp?: number;
  }) => Promise<Array<AttachmentDownloadJobType>>;

  saveJob: (job: AttachmentDownloadJobType) => Promise<void>;
  removeJob: (job: AttachmentDownloadJobType) => Promise<unknown>;
  runJob: (
    job: AttachmentDownloadJobType,
    isLastAttempt: boolean
  ) => Promise<JobResultType>;
  isInCall: () => boolean;
  beforeStart?: () => Promise<void>;
  maxAttempts: number;
};
export type JobResultType = { status: 'retry' | 'finished' };
export class AttachmentDownloadManager {
  private static _instance: AttachmentDownloadManager | undefined;
  private visibleTimelineMessages: Array<string> = [];
  private enabled: boolean = false;
  private activeJobs: Map<
    string,
    {
      completionPromise: ExplodePromiseResultType<void>;
      job: AttachmentDownloadJobType;
    }
  > = new Map();
  private timeout: NodeJS.Timeout | null = null;
  private jobStartPromises: Map<string, ExplodePromiseResultType<void>> =
    new Map();
  private jobCompletePromises: Map<string, ExplodePromiseResultType<void>> =
    new Map();

  static defaultParams: AttachmentDownloadManagerParamsType = {
    beforeStart: dataInterface.resetAttachmentDownloadActive,
    getNextJobs: dataInterface.getNextAttachmentDownloadJobs,
    saveJob: dataInterface.saveAttachmentDownloadJob,
    removeJob: dataInterface.removeAttachmentDownloadJob,
    runJob: runDownloadAttachmentJob,
    isInCall: () => {
      const reduxState = window.reduxStore?.getState();
      if (reduxState) {
        return isInCallSelector(reduxState);
      }
      return false;
    },
    maxAttempts: RETRY_CONFIG.default.maxRetries + 1,
  };

  readonly getNextJobs: AttachmentDownloadManagerParamsType['getNextJobs'];
  readonly saveJob: AttachmentDownloadManagerParamsType['saveJob'];
  readonly removeJob: AttachmentDownloadManagerParamsType['removeJob'];
  readonly runJob: AttachmentDownloadManagerParamsType['runJob'];
  readonly beforeStart: AttachmentDownloadManagerParamsType['beforeStart'];
  readonly isInCall: AttachmentDownloadManagerParamsType['isInCall'];
  readonly maxAttempts: number;

  constructor(
    params: AttachmentDownloadManagerParamsType = AttachmentDownloadManager.defaultParams
  ) {
    this.getNextJobs = params.getNextJobs;
    this.saveJob = params.saveJob;
    this.removeJob = params.removeJob;
    this.runJob = params.runJob;
    this.beforeStart = params.beforeStart;
    this.isInCall = params.isInCall;
    this.maxAttempts = params.maxAttempts;
  }

  async start(): Promise<void> {
    this.enabled = true;
    await this.beforeStart?.();
    this.tick();
  }

  async stop(): Promise<void> {
    this.enabled = false;
    clearTimeoutIfNecessary(this.timeout);
    this.timeout = null;
    await Promise.all(
      [...this.activeJobs.values()].map(
        ({ completionPromise }) => completionPromise.promise
      )
    );
  }

  tick(): void {
    clearTimeoutIfNecessary(this.timeout);
    this.timeout = null;
    drop(this.maybeStartJobs());
    this.timeout = setTimeout(() => this.tick(), TICK_INTERVAL);
  }

  async addJob(
    newJobData: NewAttachmentDownloadJobType
  ): Promise<AttachmentType> {
    const {
      attachment,
      messageId,
      attachmentType,
      receivedAt,
      sentAt,
      urgency = AttachmentDownloadUrgency.STANDARD,
    } = newJobData;
    const parseResult = attachmentDownloadJobSchema.safeParse({
      messageId,
      receivedAt,
      sentAt,
      attachmentType,
      digest: attachment.digest,
      contentType: attachment.contentType,
      size: attachment.size,
      attachment,
      active: false,
      attempts: 0,
      retryAfter: null,
      lastAttemptTimestamp: null,
    });

    if (!parseResult.success) {
      log.error(
        `AttachmentDownloadManager/addJob(${sentAt}.${attachmentType}): invalid data`,
        parseResult.error
      );
      return attachment;
    }

    const newJob = parseResult.data;
    const jobIdForLogging = getJobIdForLogging(newJob);
    const logId = `AttachmentDownloadManager/addJob(${jobIdForLogging})`;

    try {
      const runningJob = this.getRunningJob(newJob);
      if (runningJob) {
        log.info(`${logId}: already running; resetting attempts`);
        runningJob.attempts = 0;

        await this.saveJob({
          ...runningJob,
          attempts: 0,
        });
        return attachment;
      }

      await this.saveJob(newJob);
    } catch (e) {
      log.error(`${logId}: error saving job`, Errors.toLogFormat(e));
    }

    switch (urgency) {
      case AttachmentDownloadUrgency.IMMEDIATE:
        log.info(`${logId}: starting job immediately`);
        drop(this.startJob(newJob));
        break;
      case AttachmentDownloadUrgency.STANDARD:
        drop(this.maybeStartJobs());
        break;
      default:
        throw missingCaseError(urgency);
    }

    return {
      ...attachment,
      pending: true,
    };
  }

  updateVisibleTimelineMessages(messageIds: Array<string>): void {
    this.visibleTimelineMessages = messageIds;
  }

  // used in testing
  public waitForJobToBeStarted(job: AttachmentDownloadJobType): Promise<void> {
    const id = this.getJobIdIncludingAttempts(job);
    const existingPromise = this.jobStartPromises.get(id)?.promise;
    if (existingPromise) {
      return existingPromise;
    }
    const { promise, resolve, reject } = explodePromise<void>();
    this.jobStartPromises.set(id, { promise, resolve, reject });
    return promise;
  }

  public waitForJobToBeCompleted(
    job: AttachmentDownloadJobType
  ): Promise<void> {
    const id = this.getJobIdIncludingAttempts(job);
    const existingPromise = this.jobCompletePromises.get(id)?.promise;
    if (existingPromise) {
      return existingPromise;
    }
    const { promise, resolve, reject } = explodePromise<void>();
    this.jobCompletePromises.set(id, { promise, resolve, reject });
    return promise;
  }

  // Private methods

  // maybeStartJobs is called:
  // 1. every minute (via tick)
  // 2. after a job is added (via addJob)
  // 3. after a job finishes (via startJob)
  // preventing re-entrancy allow us to simplify some logic and ensure we don't try to
  // start too many jobs
  private _inMaybeStartJobs = false;
  private async maybeStartJobs(): Promise<void> {
    if (this._inMaybeStartJobs) {
      return;
    }

    try {
      this._inMaybeStartJobs = true;

      if (!this.enabled) {
        log.info(
          'AttachmentDownloadManager/_maybeStartJobs: not enabled, returning'
        );
        return;
      }

      if (this.isInCall()) {
        log.info(
          'AttachmentDownloadManager/_maybeStartJobs: holding off on starting new jobs; in call'
        );
        return;
      }

      const numJobsToStart = this.getMaximumNumberOfJobsToStart();

      if (numJobsToStart <= 0) {
        return;
      }

      const nextJobs = await this.getNextJobs({
        limit: numJobsToStart,
        // TODO (DESKTOP-6912): we'll want to prioritize more than just visible timeline
        // messages, including:
        // - media opened in lightbox
        // - media for stories
        prioritizeMessageIds: [...this.visibleTimelineMessages],
        timestamp: Date.now(),
      });

      // TODO (DESKTOP-6913): if a prioritized job is selected, we will to update the
      // in-memory job with that information so we can handle it differently, including
      // e.g. downloading a thumbnail before the full-size version
      for (const job of nextJobs) {
        drop(this.startJob(job));
      }
    } finally {
      this._inMaybeStartJobs = false;
    }
  }

  private async startJob(job: AttachmentDownloadJobType): Promise<void> {
    const logId = `AttachmentDownloadManager/startJob(${getJobIdForLogging(
      job
    )})`;
    if (this.isJobRunning(job)) {
      log.info(`${logId}: job is already running`);
      return;
    }
    const isLastAttempt = job.attempts + 1 >= this.maxAttempts;

    try {
      log.info(`${logId}: starting job`);
      this.addRunningJob(job);
      await this.saveJob({ ...job, active: true });
      this.handleJobStartPromises(job);

      const { status } = await this.runJob(job, isLastAttempt);
      log.info(`${logId}: job completed with status: ${status}`);

      switch (status) {
        case 'finished':
          await this.removeJob(job);
          return;
        case 'retry':
          if (isLastAttempt) {
            throw new Error('Cannot retry on last attempt');
          }
          await this.retryJobLater(job);
          return;
        default:
          throw missingCaseError(status);
      }
    } catch (e) {
      log.error(`${logId}: error when running job`, e);
      if (isLastAttempt) {
        await this.removeJob(job);
      } else {
        await this.retryJobLater(job);
      }
    } finally {
      this.removeRunningJob(job);
      drop(this.maybeStartJobs());
    }
  }

  private async retryJobLater(job: AttachmentDownloadJobType) {
    const now = Date.now();
    await this.saveJob({
      ...job,
      active: false,
      attempts: job.attempts + 1,
      // TODO (DESKTOP-6845): adjust retry based on job type (e.g. backup)
      retryAfter:
        now +
        exponentialBackoffSleepTime(
          job.attempts + 1,
          RETRY_CONFIG.default.backoffConfig
        ),
      lastAttemptTimestamp: now,
    });
  }
  private getActiveJobCount(): number {
    return this.activeJobs.size;
  }

  private getMaximumNumberOfJobsToStart(): number {
    return MAX_CONCURRENT_JOBS - this.getActiveJobCount();
  }

  private getRunningJob(
    job: AttachmentDownloadJobIdentifiersType
  ): AttachmentDownloadJobType | undefined {
    const id = this.getJobId(job);
    return this.activeJobs.get(id)?.job;
  }

  private isJobRunning(job: AttachmentDownloadJobType): boolean {
    return Boolean(this.getRunningJob(job));
  }

  private removeRunningJob(job: AttachmentDownloadJobType) {
    const idWithAttempts = this.getJobIdIncludingAttempts(job);
    this.jobCompletePromises.get(idWithAttempts)?.resolve();
    this.jobCompletePromises.delete(idWithAttempts);

    const id = this.getJobId(job);
    this.activeJobs.get(id)?.completionPromise.resolve();
    this.activeJobs.delete(id);
  }

  private addRunningJob(job: AttachmentDownloadJobType) {
    if (this.isJobRunning(job)) {
      const jobIdForLogging = getJobIdForLogging(job);
      log.warn(
        `attachmentDownloads/_addRunningJob: job ${jobIdForLogging} is already running`
      );
    }
    this.activeJobs.set(this.getJobId(job), {
      completionPromise: explodePromise<void>(),
      job,
    });
  }

  private handleJobStartPromises(job: AttachmentDownloadJobType) {
    const id = this.getJobIdIncludingAttempts(job);
    this.jobStartPromises.get(id)?.resolve();
    this.jobStartPromises.delete(id);
  }

  private getJobIdIncludingAttempts(job: AttachmentDownloadJobType) {
    return `${this.getJobId(job)}.${job.attempts}`;
  }

  private getJobId(job: AttachmentDownloadJobIdentifiersType): string {
    const { messageId, attachmentType, digest } = job;
    return `${messageId}.${attachmentType}.${digest}`;
  }

  // Static methods
  static get instance(): AttachmentDownloadManager {
    if (!AttachmentDownloadManager._instance) {
      AttachmentDownloadManager._instance = new AttachmentDownloadManager();
    }
    return AttachmentDownloadManager._instance;
  }

  static async start(): Promise<void> {
    log.info('AttachmentDownloadManager/starting');
    await AttachmentDownloadManager.instance.start();
  }

  static async stop(): Promise<void> {
    log.info('AttachmentDownloadManager/stopping');
    return AttachmentDownloadManager._instance?.stop();
  }

  static async addJob(
    newJob: NewAttachmentDownloadJobType
  ): Promise<AttachmentType> {
    return AttachmentDownloadManager.instance.addJob(newJob);
  }

  static updateVisibleTimelineMessages(messageIds: Array<string>): void {
    AttachmentDownloadManager.instance.updateVisibleTimelineMessages(
      messageIds
    );
  }
}

async function runDownloadAttachmentJob(
  job: AttachmentDownloadJobType,
  isLastAttempt: boolean
): Promise<JobResultType> {
  const jobIdForLogging = getJobIdForLogging(job);
  const logId = `attachment_downloads/runDownloadAttachmentJob/${jobIdForLogging}`;

  const message = await __DEPRECATED$getMessageById(job.messageId);

  if (!message) {
    log.error(`${logId} message not found`);
    return { status: 'finished' };
  }

  try {
    log.info(`${logId}: Starting job`);
    await runDownloadAttachmentJobInner(job, message);
    return { status: 'finished' };
  } catch (error) {
    log.error(
      `${logId}: Failed to download attachment, attempt ${job.attempts}:`,
      Errors.toLogFormat(error)
    );

    if (error instanceof AttachmentSizeError) {
      await addAttachmentToMessage(
        message,
        _markAttachmentAsTooBig(job.attachment),
        { type: job.attachmentType }
      );
      return { status: 'finished' };
    }

    if (error instanceof AttachmentNotFoundOnCdnError) {
      await addAttachmentToMessage(
        message,
        _markAttachmentAsPermanentlyErrored(job.attachment),
        { type: job.attachmentType }
      );

      return { status: 'finished' };
    }

    if (isLastAttempt) {
      await addAttachmentToMessage(
        message,
        _markAttachmentAsTransientlyErrored(job.attachment),
        { type: job.attachmentType }
      );
      return { status: 'finished' };
    }

    // Remove `pending` flag from the attachment and retry later
    await addAttachmentToMessage(
      message,
      {
        ...job.attachment,
        pending: false,
      },
      { type: job.attachmentType }
    );
    return { status: 'retry' };
  } finally {
    // This will fail if the message has been deleted before the download finished, which
    // is good
    await dataInterface.saveMessage(message.attributes, {
      ourAci: window.textsecure.storage.user.getCheckedAci(),
    });
  }
}

async function runDownloadAttachmentJobInner(
  job: AttachmentDownloadJobType,
  message: MessageModel
): Promise<void> {
  const { messageId, attachment, attachmentType: type } = job;

  const jobIdForLogging = getJobIdForLogging(job);
  const logId = `attachment_downloads/_runDownloadJobInner(${jobIdForLogging})`;

  if (!job || !attachment || !messageId) {
    throw new Error(`${logId}: Key information required for job was missing.`);
  }

  log.info(`${logId}: starting`);

  const maxInKib = getMaximumIncomingAttachmentSizeInKb(getValue);
  const maxTextAttachmentSizeInKib =
    getMaximumIncomingTextAttachmentSizeInKb(getValue);

  const { size } = attachment;
  const sizeInKib = size / KIBIBYTE;

  if (!Number.isFinite(size) || size < 0 || sizeInKib > maxInKib) {
    throw new AttachmentSizeError(
      `${logId}: Attachment was ${sizeInKib}kib, max is ${maxInKib}kib`
    );
  }
  if (type === 'long-message' && sizeInKib > maxTextAttachmentSizeInKib) {
    throw new AttachmentSizeError(
      `${logId}: Text attachment was ${sizeInKib}kib, max is ${maxTextAttachmentSizeInKib}kib`
    );
  }

  await addAttachmentToMessage(
    message,
    { ...attachment, pending: true },
    { type }
  );

  const downloaded = await downloadAttachment(attachment);

  const upgradedAttachment =
    await window.Signal.Migrations.processNewAttachment(downloaded);

  await addAttachmentToMessage(message, omit(upgradedAttachment, 'error'), {
    type,
  });
}

function _markAttachmentAsTooBig(attachment: AttachmentType): AttachmentType {
  return {
    ..._markAttachmentAsPermanentlyErrored(attachment),
    wasTooBig: true,
  };
}

function _markAttachmentAsPermanentlyErrored(
  attachment: AttachmentType
): AttachmentType {
  return { ...omit(attachment, ['key', 'id']), pending: false, error: true };
}

function _markAttachmentAsTransientlyErrored(
  attachment: AttachmentType
): AttachmentType {
  return { ...attachment, pending: false, error: true };
}

function getJobIdForLogging(job: AttachmentDownloadJobType): string {
  const { sentAt, attachmentType, digest } = job;
  const redactedDigest = redactGenericText(digest);
  return `${sentAt}.${attachmentType}.${redactedDigest}`;
}
