// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import lodash from 'lodash';

import * as Bytes from '../Bytes.std.ts';
import type { LoggerType } from '../types/Logging.std.ts';
import { exponentialBackoffMaxAttempts } from '../util/exponentialBackoff.std.ts';
import type { ParsedJob } from './types.std.ts';
import type { JOB_STATUS } from './JobQueue.std.ts';
import { JobQueue } from './JobQueue.std.ts';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore.preload.ts';
import { DAY } from '../util/durations/index.std.ts';
import { commonShouldJobContinue } from './helpers/commonShouldJobContinue.preload.ts';
import { SignalService as Proto } from '../protobuf/index.std.ts';
import { handleMessageSend } from '../util/handleMessageSend.preload.ts';
import { getSendOptions } from '../util/getSendOptions.preload.ts';
import type { SingleProtoJobData } from '../textsecure/SendMessage.preload.ts';
import {
  singleProtoJobDataSchema,
  messageSender,
} from '../textsecure/SendMessage.preload.ts';
import {
  handleMultipleSendErrors,
  maybeExpandErrors,
} from './helpers/handleMultipleSendErrors.std.ts';
import { parseUnknown } from '../util/schemas.std.ts';
import { shouldSendToDirectConversation } from './helpers/shouldSendToConversation.preload.ts';

const { isBoolean } = lodash;

const MAX_RETRY_TIME = DAY;
const MAX_PARALLEL_JOBS = 5;
const MAX_ATTEMPTS = exponentialBackoffMaxAttempts(MAX_RETRY_TIME);

class SingleProtoJobQueue extends JobQueue<SingleProtoJobData> {
  readonly #parallelQueue = new PQueue({ concurrency: MAX_PARALLEL_JOBS });

  protected override getQueues(): ReadonlySet<PQueue> {
    return new Set([this.#parallelQueue]);
  }

  protected override getInMemoryQueue(
    _parsedJob: ParsedJob<SingleProtoJobData>
  ): PQueue {
    return this.#parallelQueue;
  }

  protected parseData(data: unknown): SingleProtoJobData {
    return parseUnknown(singleProtoJobDataSchema, data);
  }

  protected async run(
    {
      data,
      timestamp,
    }: Readonly<{ data: SingleProtoJobData; timestamp: number }>,
    { attempt, log }: Readonly<{ attempt: number; log: LoggerType }>
  ): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
    const timeRemaining = timestamp + MAX_RETRY_TIME - Date.now();
    const isFinalAttempt = attempt >= MAX_ATTEMPTS;

    const shouldContinue = await commonShouldJobContinue({
      attempt,
      log,
      timeRemaining,
      skipWait: false,
    });
    if (!shouldContinue) {
      return undefined;
    }

    const {
      contentHint,
      serviceId,
      isSyncMessage,
      messageIds = [],
      protoBase64,
      type,
      urgent,
    } = data;
    log.info(
      `starting ${type} send to ${serviceId} with timestamp ${timestamp}`
    );

    const conversation = window.ConversationController.get(serviceId);
    if (!conversation) {
      throw new Error(`Failed to get conversation for serviceId ${serviceId}`);
    }

    const [ok, refusal] = shouldSendToDirectConversation(conversation);
    if (!ok) {
      log.info(refusal.logLine);
      return undefined;
    }

    const proto = Proto.Content.decode(Bytes.fromBase64(protoBase64));
    const options = await getSendOptions(conversation.attributes, {
      syncMessage: isSyncMessage,
    });

    try {
      await handleMessageSend(
        messageSender.sendIndividualProto({
          contentHint,
          serviceId,
          options,
          proto,
          timestamp,
          urgent: isBoolean(urgent) ? urgent : true,
        }),
        { messageIds, sendType: type }
      );
    } catch (error: unknown) {
      await handleMultipleSendErrors({
        errors: maybeExpandErrors(error),
        isFinalAttempt,
        log,
        timeRemaining,
        toThrow: error,
      });
    }

    return undefined;
  }
}

export const singleProtoJobQueue = new SingleProtoJobQueue({
  maxAttempts: MAX_ATTEMPTS,
  queueType: 'single proto',
  store: jobQueueDatabaseStore,
});
