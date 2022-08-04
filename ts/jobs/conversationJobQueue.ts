// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import type PQueue from 'p-queue';
import * as globalLogger from '../logging/log';

import * as durations from '../util/durations';
import { exponentialBackoffMaxAttempts } from '../util/exponentialBackoff';
import { commonShouldJobContinue } from './helpers/commonShouldJobContinue';
import { InMemoryQueues } from './helpers/InMemoryQueues';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore';
import { JobQueue } from './JobQueue';

import { sendNormalMessage } from './helpers/sendNormalMessage';
import { sendDirectExpirationTimerUpdate } from './helpers/sendDirectExpirationTimerUpdate';
import { sendGroupUpdate } from './helpers/sendGroupUpdate';
import { sendDeleteForEveryone } from './helpers/sendDeleteForEveryone';
import { sendProfileKey } from './helpers/sendProfileKey';
import { sendReaction } from './helpers/sendReaction';
import { sendStory } from './helpers/sendStory';

import type { LoggerType } from '../types/Logging';
import { ConversationVerificationState } from '../state/ducks/conversationsEnums';
import { sleep } from '../util/sleep';
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
import type { ParsedJob } from './types';
import type SendMessage from '../textsecure/SendMessage';

// Note: generally, we only want to add to this list. If you do need to change one of
//   these values, you'll likely need to write a database migration.
export const conversationQueueJobEnum = z.enum([
  'DeleteForEveryone',
  'DirectExpirationTimerUpdate',
  'GroupUpdate',
  'NormalMessage',
  'ProfileKey',
  'Reaction',
  'Story',
]);

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

const expirationTimerUpdateJobDataSchema = z.object({
  type: z.literal(conversationQueueJobEnum.enum.DirectExpirationTimerUpdate),
  conversationId: z.string(),
  expireTimer: z.number().or(z.undefined()),
  // Note: no recipients/revision, because this job is for 1:1 conversations only!
});
export type ExpirationTimerUpdateJobData = z.infer<
  typeof expirationTimerUpdateJobDataSchema
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
});
export type NormalMessageSendJobData = z.infer<
  typeof normalMessageSendJobDataSchema
>;

const profileKeyJobDataSchema = z.object({
  type: z.literal(conversationQueueJobEnum.enum.ProfileKey),
  conversationId: z.string(),
  // Note: we will use whichever recipients list is up to date when this job runs
  revision: z.number().optional(),
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

const storyJobDataSchema = z.object({
  type: z.literal(conversationQueueJobEnum.enum.Story),
  conversationId: z.string(),
  // Note: recipients are baked into the message itself
  messageIds: z.string().array(),
  timestamp: z.number(),
  revision: z.number().optional(),
});
export type StoryJobData = z.infer<typeof storyJobDataSchema>;

export const conversationQueueJobDataSchema = z.union([
  deleteForEveryoneJobDataSchema,
  expirationTimerUpdateJobDataSchema,
  groupUpdateJobDataSchema,
  normalMessageSendJobDataSchema,
  profileKeyJobDataSchema,
  reactionJobDataSchema,
  storyJobDataSchema,
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

export class ConversationJobQueue extends JobQueue<ConversationQueueJobData> {
  private readonly inMemoryQueues = new InMemoryQueues();
  private readonly verificationWaitMap = new Map<
    string,
    {
      resolve: (value: unknown) => unknown;
      reject: (error: Error) => unknown;
      promise: Promise<unknown>;
    }
  >();

  public override async add(
    data: Readonly<ConversationQueueJobData>,
    insert?: (job: ParsedJob<ConversationQueueJobData>) => Promise<void>
  ): Promise<Job<ConversationQueueJobData>> {
    const { conversationId } = data;
    strictAssert(
      window.Signal.challengeHandler,
      'conversationJobQueue.add: Missing challengeHandler!'
    );
    window.Signal.challengeHandler.maybeSolve(conversationId);

    return super.add(data, insert);
  }

  protected parseData(data: unknown): ConversationQueueJobData {
    return conversationQueueJobDataSchema.parse(data);
  }

  protected override getInMemoryQueue({
    data,
  }: Readonly<{ data: ConversationQueueJobData }>): PQueue {
    return this.inMemoryQueues.get(data.conversationId);
  }

  private startVerificationWaiter(conversationId: string): Promise<unknown> {
    const existing = this.verificationWaitMap.get(conversationId);
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
    this.verificationWaitMap.set(conversationId, {
      resolve,
      reject,
      promise,
    });

    return promise;
  }

  public resolveVerificationWaiter(conversationId: string): void {
    const existing = this.verificationWaitMap.get(conversationId);
    if (existing) {
      globalLogger.info(
        `resolveVerificationWaiter: Found waiter for conversation ${conversationId}. Resolving.`
      );
      existing.resolve('resolveVerificationWaiter: success');
      this.verificationWaitMap.delete(conversationId);
    } else {
      globalLogger.warn(
        `resolveVerificationWaiter: Missing waiter for conversation ${conversationId}.`
      );
    }
  }

  protected async run(
    {
      data,
      timestamp,
    }: Readonly<{ data: ConversationQueueJobData; timestamp: number }>,
    { attempt, log }: Readonly<{ attempt: number; log: LoggerType }>
  ): Promise<void> {
    const { type, conversationId } = data;
    const isFinalAttempt = attempt >= MAX_ATTEMPTS;

    await window.ConversationController.load();

    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      throw new Error(`Failed to find conversation ${conversationId}`);
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
        break;
      }

      if (window.Signal.challengeHandler?.isRegistered(conversationId)) {
        log.info(
          'captcha challenge is pending for this conversation; waiting at most 5m...'
        );
        // eslint-disable-next-line no-await-in-loop
        await Promise.race([
          this.startVerificationWaiter(conversation.id),
          sleep(5 * MINUTE),
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
        log.info(
          'verification is pending for this conversation; waiting at most 5m...'
        );
        // eslint-disable-next-line no-await-in-loop
        await Promise.race([
          this.startVerificationWaiter(conversation.id),
          sleep(5 * MINUTE),
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
        case jobSet.DeleteForEveryone:
          await sendDeleteForEveryone(conversation, jobBundle, data);
          break;
        case jobSet.DirectExpirationTimerUpdate:
          await sendDirectExpirationTimerUpdate(conversation, jobBundle, data);
          break;
        case jobSet.GroupUpdate:
          await sendGroupUpdate(conversation, jobBundle, data);
          break;
        case jobSet.NormalMessage:
          await sendNormalMessage(conversation, jobBundle, data);
          break;
        case jobSet.ProfileKey:
          await sendProfileKey(conversation, jobBundle, data);
          break;
        case jobSet.Reaction:
          await sendReaction(conversation, jobBundle, data);
          break;
        case jobSet.Story:
          await sendStory(conversation, jobBundle, data);
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
    } catch (error: unknown) {
      const untrustedUuids: Array<string> = [];

      const processError = (toProcess: unknown) => {
        if (toProcess instanceof OutgoingIdentityKeyError) {
          const failedConversation = window.ConversationController.getOrCreate(
            toProcess.identifier,
            'private'
          );
          strictAssert(failedConversation, 'Conversation should be created');
          const uuid = failedConversation.get('uuid');
          if (!uuid) {
            log.error(
              `failedConversation: Conversation ${failedConversation.idForLogging()} missing UUID!`
            );
            return;
          }
          untrustedUuids.push(uuid);
        } else if (toProcess instanceof SendMessageChallengeError) {
          window.Signal.challengeHandler?.register(
            {
              conversationId,
              createdAt: Date.now(),
              retryAt: toProcess.retryAt,
              token: toProcess.data?.token,
            },
            toProcess.data
          );
        }
      };

      processError(error);
      if (error instanceof SendMessageProtoError) {
        (error.errors || []).forEach(processError);
      }

      if (untrustedUuids.length) {
        log.error(
          `Send failed because ${untrustedUuids.length} conversation(s) were untrusted. Adding to verification list.`
        );
        window.reduxActions.conversations.conversationStoppedByMissingVerification(
          {
            conversationId: conversation.id,
            untrustedUuids,
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
