// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import lodash from 'lodash';

import * as Bytes from '../Bytes.std.js';
import type { LoggerType } from '../types/Logging.std.js';
import { exponentialBackoffMaxAttempts } from '../util/exponentialBackoff.std.js';
import type { ParsedJob } from './types.std.js';
import type { JOB_STATUS } from './JobQueue.std.js';
import { JobQueue } from './JobQueue.std.js';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore.preload.js';
import { DAY } from '../util/durations/index.std.js';
import { commonShouldJobContinue } from './helpers/commonShouldJobContinue.preload.js';
import { SignalService as Proto } from '../protobuf/index.std.js';
import { handleMessageSend } from '../util/handleMessageSend.preload.js';
import { getSendOptions } from '../util/getSendOptions.preload.js';
import type { SingleProtoJobData } from '../textsecure/SendMessage.preload.js';
import {
  singleProtoJobDataSchema,
  messageSender,
} from '../textsecure/SendMessage.preload.js';
import {
  handleMultipleSendErrors,
  maybeExpandErrors,
} from './helpers/handleMultipleSendErrors.std.js';
import { isConversationUnregistered } from '../util/isConversationUnregistered.dom.js';
import { isConversationAccepted } from '../util/isConversationAccepted.preload.js';
import { parseUnknown } from '../util/schemas.std.js';

const { isBoolean } = lodash;

const MAX_RETRY_TIME = DAY;
const MAX_PARALLEL_JOBS = 5;
const MAX_ATTEMPTS = exponentialBackoffMaxAttempts(MAX_RETRY_TIME);

export class SingleProtoJobQueue extends JobQueue<SingleProtoJobData> {
  #parallelQueue = new PQueue({ concurrency: MAX_PARALLEL_JOBS });

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

    if (!isConversationAccepted(conversation.attributes)) {
      log.info(
        `conversation ${conversation.idForLogging()} is not accepted; refusing to send`
      );
      return undefined;
    }
    if (isConversationUnregistered(conversation.attributes)) {
      log.info(
        `conversation ${conversation.idForLogging()} is unregistered; refusing to send`
      );
      return undefined;
    }
    if (conversation.isBlocked()) {
      log.info(
        `conversation ${conversation.idForLogging()} is blocked; refusing to send`
      );
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
