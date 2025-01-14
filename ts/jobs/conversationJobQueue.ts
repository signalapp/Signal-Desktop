// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import type PQueue from 'p-queue';
import * as globalLogger from '../logging/log';

import * as durations from '../util/durations';
import { exponentialBackoffMaxAttempts } from '../util/exponentialBackoff';
import { InMemoryQueues } from './helpers/InMemoryQueues';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore';
import { JOB_STATUS, JobQueue } from './JobQueue';

import { sendNormalMessage } from './helpers/sendNormalMessage';
import { sendCallingMessage } from './helpers/sendCallingMessage';
import { sendDirectExpirationTimerUpdate } from './helpers/sendDirectExpirationTimerUpdate';
import { sendGroupCallUpdate } from './helpers/sendGroupCallUpdate';
import { sendGroupUpdate } from './helpers/sendGroupUpdate';
import { sendDeleteForEveryone } from './helpers/sendDeleteForEveryone';
import { sendDeleteStoryForEveryone } from './helpers/sendDeleteStoryForEveryone';
import { sendProfileKey } from './helpers/sendProfileKey';
import { sendReaction } from './helpers/sendReaction';
import { sendStory } from './helpers/sendStory';
import { sendReceipts } from './helpers/sendReceipts';

import type { LoggerType } from '../types/Logging';
import { ConversationVerificationState } from '../state/ducks/conversationsEnums';
import { MINUTE } from '../util/durations';
import {
  OutgoingIdentityKeyError,
  SendMessageChallengeError,
  SendMessageProtoError,
} from '../textsecure/Errors';
import { strictAssert } from '../util/assert';
import { missingCaseError } from '../util/missingCaseError';
import { explodePromise } from '../util/explodePromise';
import type { Job } from './Job';
import type { ParsedJob, StoredJob } from './types';
import type SendMessage from '../textsecure/SendMessage';
import type { ServiceIdString } from '../types/ServiceId';
import { commonShouldJobContinue } from './helpers/commonShouldJobContinue';
import { sleeper } from '../util/sleeper';
import { receiptSchema, ReceiptType } from '../types/Receipt';
import { serviceIdSchema, aciSchema } from '../types/ServiceId';
import { sendResendRequest } from './helpers/sendResendRequest';
import { sendNullMessage } from './helpers/sendNullMessage';
import { sendSenderKeyDistribution } from './helpers/sendSenderKeyDistribution';
import { sendSavedProto } from './helpers/sendSavedProto';
import { drop } from '../util/drop';
import { isInPast } from '../util/timestamp';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary';
import { FIBONACCI } from '../util/BackOff';
import { parseUnknown } from '../util/schemas';

// Note: generally, we only want to add to this list. If you do need to change one of
//   these values, you'll likely need to write a database migration.
export const conversationQueueJobEnum = z.enum([
  'CallingMessage',
  'DeleteForEveryone',
  'DeleteStoryForEveryone',
  'DirectExpirationTimerUpdate',
  'GroupCallUpdate',
  'GroupUpdate',
  'NormalMessage',
  'NullMessage',
  'ProfileKey',
  'ProfileKeyForCall',
  'Reaction',
  'ResendRequest',
  'SavedProto',
  'SenderKeyDistribution',
  'Story',
  'Receipts',
]);
type ConversationQueueJobEnum = z.infer<typeof conversationQueueJobEnum>;

const callingMessageJobDataSchema = z.object({
  type: z.literal(conversationQueueJobEnum.enum.CallingMessage),
  conversationId: z.string(),
  protoBase64: z.string(),
  urgent: z.boolean(),
  // These are group-only
  recipients: z.array(serviceIdSchema).optional(),
  isPartialSend: z.boolean().optional(),
  groupId: z.string().optional(),
});
export type CallingMessageJobData = z.infer<typeof callingMessageJobDataSchema>;

const deleteForEveryoneJobDataSchema = z.object({
  type: z.literal(conversationQueueJobEnum.enum.DeleteForEveryone),
  conversationId: z.string(),
  messageId: z.string(),
  recipients: z.array(z.string()),
  revision: z.number().optional(),
  targetTimestamp: z.number(),
});
export type DeleteForEveryoneJobData = z.infer<
  typeof deleteForEveryoneJobDataSchema
>;

const deleteStoryForEveryoneJobDataSchema = z.object({
  type: z.literal(conversationQueueJobEnum.enum.DeleteStoryForEveryone),
  conversationId: z.string(),
  storyId: z.string(),
  targetTimestamp: z.number(),
  updatedStoryRecipients: z
    .array(
      z.object({
        destinationServiceId: serviceIdSchema.optional(),
        distributionListIds: z.array(z.string()),
        isAllowedToReply: z.boolean(),
      })
    )
    .optional(),
});
export type DeleteStoryForEveryoneJobData = z.infer<
  typeof deleteStoryForEveryoneJobDataSchema
>;

const expirationTimerUpdateJobDataSchema = z.object({
  type: z.literal(conversationQueueJobEnum.enum.DirectExpirationTimerUpdate),
  conversationId: z.string(),
  expireTimer: z.number().or(z.undefined()),
  // Note: no recipients/revision, because this job is for 1:1 conversations only!
});
export type ExpirationTimerUpdateJobData = z.infer<
  typeof expirationTimerUpdateJobDataSchema
>;

const groupCallUpdateJobDataSchema = z.object({
  type: z.literal(conversationQueueJobEnum.enum.GroupCallUpdate),
  conversationId: z.string(),
  eraId: z.string(),
  urgent: z.boolean(),
});
export type GroupCallUpdateJobData = z.infer<
  typeof groupCallUpdateJobDataSchema
>;

const groupUpdateJobDataSchema = z.object({
  type: z.literal(conversationQueueJobEnum.enum.GroupUpdate),
  conversationId: z.string(),
  groupChangeBase64: z.string().optional(),
  recipients: z.array(z.string()),
  revision: z.number(),
});
export type GroupUpdateJobData = z.infer<typeof groupUpdateJobDataSchema>;

const normalMessageSendJobDataSchema = z.object({
  type: z.literal(conversationQueueJobEnum.enum.NormalMessage),
  conversationId: z.string(),
  messageId: z.string(),
  // Note: recipients are baked into the message itself
  revision: z.number().optional(),
  // See sendEditedMessage
  editedMessageTimestamp: z.number().optional(),
});
export type NormalMessageSendJobData = z.infer<
  typeof normalMessageSendJobDataSchema
>;

const nullMessageJobDataSchema = z.object({
  type: z.literal(conversationQueueJobEnum.enum.NullMessage),
  conversationId: z.string(),
  idForTracking: z.string().optional(),
});
export type NullMessageJobData = z.infer<typeof nullMessageJobDataSchema>;

const profileKeyJobDataSchema = z.object({
  type: z.union([
    z.literal(conversationQueueJobEnum.enum.ProfileKey),
    z.literal(conversationQueueJobEnum.enum.ProfileKeyForCall),
  ]),
  conversationId: z.string(),
  // Note: we will use whichever recipients list is up to date when this job runs
  revision: z.number().optional(),
  // Setting this to true lets you send profile key without adding to contacts
  isOneTimeSend: z.boolean().optional(),
});
export type ProfileKeyJobData = z.infer<typeof profileKeyJobDataSchema>;

const reactionJobDataSchema = z.object({
  type: z.literal(conversationQueueJobEnum.enum.Reaction),
  conversationId: z.string(),
  messageId: z.string(),
  // Note: recipients are baked into the message itself
  revision: z.number().optional(),
});
export type ReactionJobData = z.infer<typeof reactionJobDataSchema>;

const resendRequestJobDataSchema = z.object({
  type: z.literal(conversationQueueJobEnum.enum.ResendRequest),
  conversationId: z.string(),
  contentHint: z.number().optional(),
  groupId: z.string().optional(),
  plaintext: z.string(),
  receivedAtCounter: z.number(),
  receivedAtDate: z.number(),
  senderAci: aciSchema,
  senderDevice: z.number(),
  timestamp: z.number(),
});
export type ResendRequestJobData = z.infer<typeof resendRequestJobDataSchema>;

const savedProtoJobDataSchema = z.object({
  type: z.literal(conversationQueueJobEnum.enum.SavedProto),
  conversationId: z.string(),
  contentHint: z.number(),
  groupId: z.string().optional(),
  protoBase64: z.string(),
  story: z.boolean(),
  timestamp: z.number(),
  urgent: z.boolean(),
});
export type SavedProtoJobData = z.infer<typeof savedProtoJobDataSchema>;

const senderKeyDistributionJobDataSchema = z.object({
  type: z.literal(conversationQueueJobEnum.enum.SenderKeyDistribution),
  conversationId: z.string(),
  groupId: z.string(),
});
export type SenderKeyDistributionJobData = z.infer<
  typeof senderKeyDistributionJobDataSchema
>;

const storyJobDataSchema = z.object({
  type: z.literal(conversationQueueJobEnum.enum.Story),
  conversationId: z.string(),
  // Note: recipients are baked into the message itself
  messageIds: z.string().array(),
  timestamp: z.number(),
  revision: z.number().optional(),
});
export type StoryJobData = z.infer<typeof storyJobDataSchema>;

const receiptsJobDataSchema = z.object({
  type: z.literal(conversationQueueJobEnum.enum.Receipts),
  conversationId: z.string(),
  receiptsType: z.nativeEnum(ReceiptType),
  receipts: receiptSchema.array(),
});
export type ReceiptsJobData = z.infer<typeof receiptsJobDataSchema>;

export const conversationQueueJobDataSchema = z.union([
  callingMessageJobDataSchema,
  deleteForEveryoneJobDataSchema,
  deleteStoryForEveryoneJobDataSchema,
  expirationTimerUpdateJobDataSchema,
  groupCallUpdateJobDataSchema,
  groupUpdateJobDataSchema,
  normalMessageSendJobDataSchema,
  nullMessageJobDataSchema,
  profileKeyJobDataSchema,
  reactionJobDataSchema,
  resendRequestJobDataSchema,
  savedProtoJobDataSchema,
  senderKeyDistributionJobDataSchema,
  storyJobDataSchema,
  receiptsJobDataSchema,
]);
export type ConversationQueueJobData = z.infer<
  typeof conversationQueueJobDataSchema
>;

export type ConversationQueueJobBundle = {
  isFinalAttempt: boolean;
  log: LoggerType;
  messaging: SendMessage;
  shouldContinue: boolean;
  timeRemaining: number;
  timestamp: number;
};

const MAX_RETRY_TIME = durations.DAY;
const MAX_ATTEMPTS = exponentialBackoffMaxAttempts(MAX_RETRY_TIME);

function shouldSendShowCaptcha(type: ConversationQueueJobEnum): boolean {
  if (type === 'CallingMessage') {
    return true;
  }
  if (type === 'DeleteForEveryone') {
    return true;
  }
  if (type === 'DeleteStoryForEveryone') {
    return true;
  }
  if (type === 'DirectExpirationTimerUpdate') {
    return true;
  }
  if (type === 'GroupCallUpdate') {
    return true;
  }
  if (type === 'GroupUpdate') {
    return true;
  }
  if (type === 'NormalMessage') {
    return true;
  }
  if (type === 'NullMessage') {
    return false;
  }
  if (type === 'ProfileKey') {
    return false;
  }
  if (type === 'ProfileKeyForCall') {
    return true;
  }
  if (type === 'Reaction') {
    return false;
  }
  if (type === 'Receipts') {
    return false;
  }
  if (type === 'ResendRequest') {
    return false;
  }
  if (type === 'SavedProto') {
    return false;
  }
  // Note: this is only for out-of-band sender key distributions (see handleRetry.ts),
  //   not the ones attached to group sends
  if (type === 'SenderKeyDistribution') {
    return false;
  }
  if (type === 'Story') {
    return true;
  }

  throw missingCaseError(type);
}

enum RETRY_STATUS {
  BLOCKED = 'BLOCKED',
  BLOCKED_WITH_JOBS = 'BLOCKED_WITH_JOBS',
  UNBLOCKED = 'UNBLOCKED',
  RUNNING = 'RUNNING',
}

type ConversationData = Readonly<
  | {
      // When we get a retryAt from a 428 error, we immediately record it, but we don't
      //   yet have a job to retry. We should, very soon, when the job returns
      //   JOB_STATUS.NEEDS_RETRY. This should be a very short-lived state.
      status: RETRY_STATUS.BLOCKED;
      attempts: number;
      callback: undefined;
      jobsNeedingRetry: undefined;
      retryAt: number;
    }
  | {
      // This is the next stage, when we've added at least one job needing retry, and we
      //   have a callback registered to run on queue idle (or be called directly).
      status: RETRY_STATUS.BLOCKED_WITH_JOBS;
      attempts: number;
      callback: () => void;
      jobsNeedingRetry: Array<Readonly<StoredJob>>;
      retryAt: number;
      retryAtTimeout?: NodeJS.Timeout;
    }
  | {
      // When we discover that we can now run these deferred jobs, we flip into this
      //   state, which should be short-lived. We very quickly re-enqueue all
      //   jobsNeedingRetry, and move to RETRY_STATUS.RUNNING for this conversation.
      status: RETRY_STATUS.UNBLOCKED;
      attempts: number;
      callback: () => void;
      jobsNeedingRetry: Array<Readonly<StoredJob>>;
      retryAt: undefined;
      retryAtTimeout?: NodeJS.Timeout;
    }
  | {
      // When we've queued all jobs needing retry, and we're waiting for the results
      //   of our next set of attempted sends, we are in this state. Its only real purpose
      //   is to keep track of our attempts, so we can exponentially back off. Once a send
      //   goes through successfully, we erase perConversationData for this conversation.
      //   Otherwise, we go back to RETRY_STATUS.BLOCKED.
      status: RETRY_STATUS.RUNNING;
      attempts: number;
      callback: undefined;
      jobsNeedingRetry: undefined;
      retryAt: undefined;
      retryAtTimeout: undefined;
    }
>;

export class ConversationJobQueue extends JobQueue<ConversationQueueJobData> {
  readonly #perConversationData = new Map<
    string,
    ConversationData | undefined
  >();

  readonly #inMemoryQueues = new InMemoryQueues();

  readonly #verificationWaitMap = new Map<
    string,
    {
      resolve: (value: unknown) => unknown;
      reject: (error: Error) => unknown;
      promise: Promise<unknown>;
    }
  >();

  #callbackCount = 0;

  override getQueues(): ReadonlySet<PQueue> {
    return this.#inMemoryQueues.allQueues;
  }

  public override async add(
    data: Readonly<ConversationQueueJobData>,
    insert?: (job: ParsedJob<ConversationQueueJobData>) => Promise<void>
  ): Promise<Job<ConversationQueueJobData>> {
    const { conversationId, type } = data;

    if (shouldSendShowCaptcha(data.type)) {
      strictAssert(
        window.Signal.challengeHandler,
        'conversationJobQueue.add: Missing challengeHandler!'
      );
      window.Signal.challengeHandler.maybeSolve({
        conversationId,
        reason: `conversationJobQueue.add(${conversationId}, ${type})`,
      });
    }

    return super.add(data, insert);
  }

  protected parseData(data: unknown): ConversationQueueJobData {
    return parseUnknown(conversationQueueJobDataSchema, data);
  }

  protected override getInMemoryQueue({
    data,
  }: Readonly<{ data: ConversationQueueJobData }>): PQueue {
    return this.#inMemoryQueues.get(data.conversationId);
  }

  #startVerificationWaiter(conversationId: string): Promise<unknown> {
    const existing = this.#verificationWaitMap.get(conversationId);
    if (existing) {
      globalLogger.info(
        `startVerificationWaiter: Found existing waiter for conversation ${conversationId}. Returning it.`
      );
      return existing.promise;
    }

    globalLogger.info(
      `startVerificationWaiter: Starting new waiter for conversation ${conversationId}.`
    );
    const { resolve, reject, promise } = explodePromise();
    this.#verificationWaitMap.set(conversationId, {
      resolve,
      reject,
      promise,
    });

    return promise;
  }

  public resolveVerificationWaiter(conversationId: string): void {
    const existing = this.#verificationWaitMap.get(conversationId);
    if (existing) {
      globalLogger.info(
        `resolveVerificationWaiter: Found waiter for conversation ${conversationId}. Resolving.`
      );
      existing.resolve('resolveVerificationWaiter: success');
      this.#verificationWaitMap.delete(conversationId);
    } else {
      globalLogger.warn(
        `resolveVerificationWaiter: Missing waiter for conversation ${conversationId}.`
      );
      this.#unblockConversationRetries(conversationId);
    }
  }

  #unblockConversationRetries(conversationId: string) {
    const logId = `unblockConversationRetries/${conversationId}`;

    const perConversationData = this.#perConversationData.get(conversationId);
    if (!perConversationData) {
      return;
    }

    const { attempts, status, callback } = perConversationData;
    if (status === RETRY_STATUS.BLOCKED) {
      globalLogger.info(
        `${logId}: Previously BLOCKED, moving to RUNNING state`
      );
      this.#perConversationData.set(conversationId, {
        status: RETRY_STATUS.RUNNING,
        attempts,
        callback: undefined,
        jobsNeedingRetry: undefined,
        retryAt: undefined,
        retryAtTimeout: undefined,
      });
    } else if (status === RETRY_STATUS.BLOCKED_WITH_JOBS) {
      globalLogger.info(
        `${logId}: Moving previous BLOCKED state to UNBLOCKED, calling callback directly`
      );
      this.#perConversationData.set(conversationId, {
        ...perConversationData,
        status: RETRY_STATUS.UNBLOCKED,
        retryAt: undefined,
      });
      callback();
    } else if (status === RETRY_STATUS.UNBLOCKED) {
      globalLogger.warn(
        `${logId}: We're still in UNBLOCKED state; calling callback directly`
      );
      callback();
    } else if (status === RETRY_STATUS.RUNNING) {
      globalLogger.warn(
        `${logId}: We're already in RUNNING state; doing nothing`
      );
    } else {
      throw missingCaseError(status);
    }
  }

  #recordSuccessfulSend(conversationId: string) {
    const logId = `recordSuccessfulSend/${conversationId}`;

    const perConversationData = this.#perConversationData.get(conversationId);
    if (!perConversationData) {
      return;
    }

    const { status } = perConversationData;
    if (status === RETRY_STATUS.RUNNING || status === RETRY_STATUS.BLOCKED) {
      globalLogger.info(`${logId}: Previously ${status}; clearing state`);
      this.#perConversationData.delete(conversationId);
    } else if (
      status === RETRY_STATUS.BLOCKED_WITH_JOBS ||
      status === RETRY_STATUS.UNBLOCKED
    ) {
      globalLogger.warn(
        `${logId}: We're still in ${status} state; calling unblockConversationRetries`
      );
      // We have to do this because in these states there are jobs that need to be retried
      this.#unblockConversationRetries(conversationId);
    } else {
      throw missingCaseError(status);
    }
  }

  #getRetryWithBackoff(attempts: number) {
    return (
      Date.now() +
      MINUTE * (FIBONACCI[attempts] ?? FIBONACCI[FIBONACCI.length - 1])
    );
  }

  #captureRetryAt(conversationId: string, retryAt: number | undefined) {
    const logId = `captureRetryAt/${conversationId}`;

    const perConversationData = this.#perConversationData.get(conversationId);
    if (!perConversationData) {
      const newRetryAt = retryAt || Date.now() + MINUTE;
      if (!retryAt) {
        globalLogger.warn(
          `${logId}: No existing data, using retryAt of ${newRetryAt}`
        );
      }
      this.#perConversationData.set(conversationId, {
        status: RETRY_STATUS.BLOCKED,
        attempts: 1,
        retryAt: newRetryAt,
        callback: undefined,
        jobsNeedingRetry: undefined,
      });

      return;
    }

    const { status, retryAt: existingRetryAt } = perConversationData;
    const attempts = perConversationData.attempts + 1;
    const retryWithBackoff = this.#getRetryWithBackoff(attempts);

    if (existingRetryAt && existingRetryAt >= retryWithBackoff) {
      globalLogger.warn(
        `${logId}: New newRetryAt ${retryWithBackoff} isn't after existing retryAt ${existingRetryAt}, dropping`
      );
      return;
    }

    if (
      status === RETRY_STATUS.BLOCKED ||
      status === RETRY_STATUS.BLOCKED_WITH_JOBS
    ) {
      globalLogger.info(
        `${logId}: Updating to new retryAt ${retryWithBackoff} (attempts ${attempts}) from existing retryAt ${existingRetryAt}, status ${status}`
      );
      this.#perConversationData.set(conversationId, {
        ...perConversationData,
        retryAt: retryWithBackoff,
      });
    } else if (status === RETRY_STATUS.UNBLOCKED) {
      globalLogger.info(
        `${logId}: Updating to new retryAt ${retryWithBackoff} (attempts ${attempts}) from previous UNBLOCKED status`
      );
      this.#perConversationData.set(conversationId, {
        ...perConversationData,
        status: RETRY_STATUS.BLOCKED_WITH_JOBS,
        retryAt: retryWithBackoff,
      });
    } else if (status === RETRY_STATUS.RUNNING) {
      globalLogger.info(
        `${logId}: Updating to new retryAt ${retryWithBackoff} (attempts ${attempts}) from previous RUNNING status`
      );
      this.#perConversationData.set(conversationId, {
        status: RETRY_STATUS.BLOCKED,
        attempts,
        retryAt: retryWithBackoff,
        callback: undefined,
        jobsNeedingRetry: undefined,
      });
    } else {
      throw missingCaseError(status);
    }
  }

  override async retryJobOnQueueIdle({
    job,
    storedJob,
    logger,
  }: {
    job: Readonly<ParsedJob<ConversationQueueJobData>>;
    storedJob: Readonly<StoredJob>;
    logger: LoggerType;
  }): Promise<boolean> {
    const { conversationId } = job.data;
    const logId = `retryJobOnQueueIdle/${conversationId}/${job.id}`;
    const perConversationData = this.#perConversationData.get(conversationId);

    if (!perConversationData) {
      logger.warn(`${logId}: no data for conversation; using default retryAt`);
    } else {
      logger.warn(
        `${logId}: adding to existing data with status ${perConversationData.status}`
      );
    }

    const defaultRetryAt = Date.now() + MINUTE;
    const { attempts, callback, jobsNeedingRetry, status, retryAt } =
      perConversationData || {
        attempts: 1,
        status: RETRY_STATUS.BLOCKED,
        retryAt: defaultRetryAt,
      };

    const newJobsNeedingRetry = (jobsNeedingRetry || []).concat([storedJob]);
    logger.info(
      `${logId}: job added to retry queue with status ${status}; ${newJobsNeedingRetry.length} items now in queue`
    );

    const newCallback =
      callback || this.#createRetryCallback(conversationId, job.id);

    if (
      status === RETRY_STATUS.BLOCKED ||
      status === RETRY_STATUS.BLOCKED_WITH_JOBS
    ) {
      this.#perConversationData.set(conversationId, {
        status: RETRY_STATUS.BLOCKED_WITH_JOBS,
        attempts,
        retryAt,
        jobsNeedingRetry: newJobsNeedingRetry,
        callback: newCallback,
      });
    } else if (status === RETRY_STATUS.RUNNING) {
      const newAttempts = attempts + 1;
      const newRetryAt = this.#getRetryWithBackoff(newAttempts);
      logger.warn(
        `${logId}: Moving from state RUNNING to BLOCKED_WITH_JOBS, with retryAt ${newRetryAt}, (attempts ${newAttempts})`
      );
      this.#perConversationData.set(conversationId, {
        status: RETRY_STATUS.BLOCKED_WITH_JOBS,
        attempts: newAttempts,
        retryAt: newRetryAt,
        jobsNeedingRetry: newJobsNeedingRetry,
        callback: newCallback,
      });
    } else {
      this.#perConversationData.set(conversationId, {
        status: RETRY_STATUS.UNBLOCKED,
        attempts,
        retryAt,
        jobsNeedingRetry: newJobsNeedingRetry,
        callback: newCallback,
      });
    }

    if (newCallback !== callback) {
      const queue = this.getInMemoryQueue(job);
      drop(
        // eslint-disable-next-line more/no-then
        queue.onIdle().then(() => {
          globalLogger.info(`${logId}: Running callback due to queue.onIdle`);
          newCallback();
        })
      );
    }

    return true;
  }

  #createRetryCallback(conversationId: string, jobId: string) {
    this.#callbackCount += 1;
    const id = this.#callbackCount;

    globalLogger.info(
      `createRetryCallback/${conversationId}/${id}: callback created for job ${jobId}`
    );

    return () => {
      const logId = `retryCallback/${conversationId}/${id}`;

      const perConversationData = this.#perConversationData.get(conversationId);
      if (!perConversationData) {
        globalLogger.warn(`${logId}: no perConversationData, returning early.`);
        return;
      }

      const { status, retryAt } = perConversationData;
      if (status === RETRY_STATUS.BLOCKED || status === RETRY_STATUS.RUNNING) {
        globalLogger.warn(`${logId}: In ${status} state; no jobs to retry.`);
        return;
      }

      const { attempts, callback, jobsNeedingRetry, retryAtTimeout } =
        perConversationData;

      if (retryAtTimeout) {
        clearTimeoutIfNecessary(retryAtTimeout);
      }

      if (!retryAt || isInPast(retryAt)) {
        globalLogger.info(
          `${logId}: retryAt is ${retryAt}; queueing ${jobsNeedingRetry?.length} jobs needing retry`
        );

        // We're starting to retry jobs; remove the challenge handler
        drop(window.Signal.challengeHandler?.unregister(conversationId, logId));

        this.#perConversationData.set(conversationId, {
          status: RETRY_STATUS.RUNNING,
          attempts,
          callback: undefined,
          jobsNeedingRetry: undefined,
          retryAt: undefined,
          retryAtTimeout: undefined,
        });
        jobsNeedingRetry?.forEach(job => {
          drop(this.enqueueStoredJob(job));
        });

        return;
      }

      const timeLeft = retryAt - Date.now();
      globalLogger.info(
        `${logId}: retryAt ${retryAt} is in the future, scheduling timeout for ${timeLeft}ms`
      );

      this.#perConversationData.set(conversationId, {
        ...perConversationData,
        retryAtTimeout: setTimeout(() => {
          globalLogger.info(`${logId}: Running callback due to timeout`);
          callback();
        }, timeLeft),
      });
    };
  }

  protected async run(
    {
      data,
      timestamp,
    }: Readonly<{ data: ConversationQueueJobData; timestamp: number }>,
    { attempt, log }: Readonly<{ attempt: number; log: LoggerType }>
  ): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
    const { type, conversationId } = data;
    const isFinalAttempt = attempt >= MAX_ATTEMPTS;
    const perConversationData = this.#perConversationData.get(conversationId);

    await window.ConversationController.load();

    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      throw new Error(`Failed to find conversation ${conversationId}`);
    }

    if (perConversationData?.retryAt && !shouldSendShowCaptcha(type)) {
      // If we return this value, JobQueue will call retryJobOnQueueIdle for this job
      return JOB_STATUS.NEEDS_RETRY;
    }

    let timeRemaining: number;
    let shouldContinue: boolean;
    let count = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      count += 1;
      log.info('calculating timeRemaining and shouldContinue...');
      timeRemaining = timestamp + MAX_RETRY_TIME - Date.now();
      // eslint-disable-next-line no-await-in-loop
      shouldContinue = await commonShouldJobContinue({
        attempt,
        log,
        timeRemaining,
        skipWait: count > 1,
      });
      if (!shouldContinue) {
        // We don't return here because each sub-task has its own cleanup sequence
        break;
      }

      const isChallengeRegistered =
        window.Signal.challengeHandler?.isRegistered(conversationId);
      if (!isChallengeRegistered) {
        this.#unblockConversationRetries(conversationId);
      }

      if (isChallengeRegistered && shouldSendShowCaptcha(type)) {
        if (this.isShuttingDown) {
          throw new Error("Shutting down, can't wait for captcha challenge.");
        }

        window.Signal.challengeHandler?.maybeSolve({
          conversationId,
          reason:
            'conversationJobQueue.run/addWaiter(' +
            `${conversation.idForLogging()}, ${type}, ${timestamp})`,
        });

        log.info(
          'captcha challenge is pending for this conversation; waiting at most 5m...'
        );
        // eslint-disable-next-line no-await-in-loop
        await Promise.race([
          this.#startVerificationWaiter(conversation.id),
          // don't resolve on shutdown, otherwise we end up in an infinite loop
          sleeper.sleep(
            5 * MINUTE,
            `conversationJobQueue: waiting for captcha: ${conversation.idForLogging()}`,
            { resolveOnShutdown: false }
          ),
        ]);
        continue;
      }

      const verificationData =
        window.reduxStore.getState().conversations
          .verificationDataByConversation[conversationId];

      if (!verificationData) {
        break;
      }

      if (
        verificationData.type ===
        ConversationVerificationState.PendingVerification
      ) {
        if (type === conversationQueueJobEnum.enum.ProfileKey) {
          log.warn(
            "Cancelling profile share, we don't want to wait for pending verification."
          );
          return undefined;
        }

        if (this.isShuttingDown) {
          throw new Error("Shutting down, can't wait for verification.");
        }

        log.info(
          'verification is pending for this conversation; waiting at most 5m...'
        );
        // eslint-disable-next-line no-await-in-loop
        await Promise.race([
          this.#startVerificationWaiter(conversation.id),
          // don't resolve on shutdown, otherwise we end up in an infinite loop
          sleeper.sleep(
            5 * MINUTE,
            `conversationJobQueue: verification pending: ${conversation.idForLogging()}`,
            { resolveOnShutdown: false }
          ),
        ]);
        continue;
      }

      if (
        verificationData.type ===
        ConversationVerificationState.VerificationCancelled
      ) {
        if (verificationData.canceledAt >= timestamp) {
          log.info(
            'cancelling job; user cancelled out of verification dialog.'
          );
          shouldContinue = false;
        } else {
          log.info(
            'clearing cancellation tombstone; continuing ahead with job'
          );
          window.reduxActions.conversations.clearCancelledConversationVerification(
            conversation.id
          );
        }
        break;
      }

      throw missingCaseError(verificationData);
    }

    const { messaging } = window.textsecure;
    if (!messaging) {
      throw new Error('messaging interface is not available!');
    }

    const jobBundle: ConversationQueueJobBundle = {
      messaging,
      isFinalAttempt,
      shouldContinue,
      timeRemaining,
      timestamp,
      log,
    };
    // Note: A six-letter variable makes below code autoformatting easier to read.
    const jobSet = conversationQueueJobEnum.enum;

    try {
      switch (type) {
        case jobSet.CallingMessage:
          await sendCallingMessage(conversation, jobBundle, data);
          break;
        case jobSet.DeleteForEveryone:
          await sendDeleteForEveryone(conversation, jobBundle, data);
          break;
        case jobSet.DeleteStoryForEveryone:
          await sendDeleteStoryForEveryone(conversation, jobBundle, data);
          break;
        case jobSet.DirectExpirationTimerUpdate:
          await sendDirectExpirationTimerUpdate(conversation, jobBundle, data);
          break;
        case jobSet.GroupCallUpdate:
          await sendGroupCallUpdate(conversation, jobBundle, data);
          break;
        case jobSet.GroupUpdate:
          await sendGroupUpdate(conversation, jobBundle, data);
          break;
        case jobSet.NormalMessage:
          await sendNormalMessage(conversation, jobBundle, data);
          break;
        case jobSet.NullMessage:
          await sendNullMessage(conversation, jobBundle, data);
          break;
        case jobSet.ProfileKey:
        case jobSet.ProfileKeyForCall:
          await sendProfileKey(conversation, jobBundle, data);
          break;
        case jobSet.Reaction:
          await sendReaction(conversation, jobBundle, data);
          break;
        case jobSet.ResendRequest:
          await sendResendRequest(conversation, jobBundle, data);
          break;
        case jobSet.SavedProto:
          await sendSavedProto(conversation, jobBundle, data);
          break;
        case jobSet.SenderKeyDistribution:
          await sendSenderKeyDistribution(conversation, jobBundle, data);
          break;
        case jobSet.Story:
          await sendStory(conversation, jobBundle, data);
          break;
        case jobSet.Receipts:
          await sendReceipts(conversation, jobBundle, data);
          break;
        default: {
          // Note: This should never happen, because the zod call in parseData wouldn't
          //   accept data that doesn't look like our type specification.
          const problem: never = type;
          log.error(
            `conversationJobQueue: Got job with type ${problem}; Cancelling job.`
          );
        }
      }

      if (shouldContinue && !this.isShuttingDown) {
        this.#recordSuccessfulSend(conversationId);
      }

      return undefined;
    } catch (error: unknown) {
      const untrustedServiceIds: Array<ServiceIdString> = [];

      const processError = (
        toProcess: unknown
      ): undefined | typeof JOB_STATUS.NEEDS_RETRY => {
        if (toProcess instanceof OutgoingIdentityKeyError) {
          const failedConversation = window.ConversationController.getOrCreate(
            toProcess.identifier,
            'private'
          );
          strictAssert(failedConversation, 'Conversation should be created');
          const serviceId = failedConversation.getServiceId();
          if (!serviceId) {
            log.error(
              `failedConversation: Conversation ${failedConversation.idForLogging()} missing serviceId!`
            );
            return undefined;
          }
          untrustedServiceIds.push(serviceId);
        } else if (toProcess instanceof SendMessageChallengeError) {
          const silent = !shouldSendShowCaptcha(type);

          drop(
            window.Signal.challengeHandler?.register(
              {
                conversationId,
                createdAt: Date.now(),
                retryAt: toProcess.retryAt,
                token: toProcess.data?.token,
                reason:
                  'conversationJobQueue.run(' +
                  `${conversation.idForLogging()}, ${type}, ${timestamp})`,
                silent,
              },
              toProcess.data
            )
          );

          if (silent) {
            this.#captureRetryAt(conversationId, toProcess.retryAt);
            return JOB_STATUS.NEEDS_RETRY;
          }
        }
        return undefined;
      };

      const value = processError(error);
      if (value) {
        return value;
      }

      if (error instanceof SendMessageProtoError) {
        const values = (error.errors || []).map(processError);
        const innerValue = values.find(item => Boolean(item));
        if (innerValue) {
          return innerValue;
        }
      }

      if (untrustedServiceIds.length) {
        if (type === jobSet.ProfileKey || type === jobSet.ProfileKeyForCall) {
          log.warn(
            `Cancelling profile share, since there were ${untrustedServiceIds.length} untrusted send targets.`
          );
          return undefined;
        }

        if (type === jobSet.Receipts) {
          log.warn(
            `Cancelling receipt send, since there were ${untrustedServiceIds.length} untrusted send targets.`
          );
          return undefined;
        }

        log.error(
          `Send failed because ${untrustedServiceIds.length} conversation(s) were untrusted. Adding to verification list.`
        );

        window.reduxActions.conversations.conversationStoppedByMissingVerification(
          {
            conversationId: conversation.id,
            untrustedServiceIds,
          }
        );
      }

      throw error;
    }
  }
}

export const conversationJobQueue = new ConversationJobQueue({
  store: jobQueueDatabaseStore,
  queueType: 'conversation',
  maxAttempts: MAX_ATTEMPTS,
});
