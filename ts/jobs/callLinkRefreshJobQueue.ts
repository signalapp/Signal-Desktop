// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as z from 'zod';
import PQueue from 'p-queue';
import { CallLinkRootKey } from '@signalapp/ringrtc';
import type { LoggerType } from '../types/Logging';
import { exponentialBackoffMaxAttempts } from '../util/exponentialBackoff';
import type { ParsedJob } from './types';
import type { JOB_STATUS } from './JobQueue';
import { JobQueue } from './JobQueue';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore';
import { DAY, SECOND } from '../util/durations';
import { commonShouldJobContinue } from './helpers/commonShouldJobContinue';
import { DataReader, DataWriter } from '../sql/Client';
import type { CallLinkType } from '../types/CallLink';
import { calling } from '../services/calling';
import { sleeper } from '../util/sleeper';
import { parseUnknown } from '../util/schemas';

const MAX_RETRY_TIME = DAY;
const MAX_PARALLEL_JOBS = 5;
const MAX_ATTEMPTS = exponentialBackoffMaxAttempts(MAX_RETRY_TIME);
const DEFAULT_SLEEP_TIME = 20 * SECOND;

const callLinkRefreshJobDataSchema = z.object({
  roomId: z.string(),
  deleteLocallyIfMissingOnCallingServer: z.boolean(),
  source: z.string(),
});

export type CallLinkRefreshJobData = z.infer<
  typeof callLinkRefreshJobDataSchema
>;

export class CallLinkRefreshJobQueue extends JobQueue<CallLinkRefreshJobData> {
  private parallelQueue = new PQueue({ concurrency: MAX_PARALLEL_JOBS });

  protected override getQueues(): ReadonlySet<PQueue> {
    return new Set([this.parallelQueue]);
  }

  protected override getInMemoryQueue(
    _parsedJob: ParsedJob<CallLinkRefreshJobData>
  ): PQueue {
    return this.parallelQueue;
  }

  protected parseData(data: unknown): CallLinkRefreshJobData {
    return parseUnknown(callLinkRefreshJobDataSchema, data);
  }

  protected async run(
    {
      data,
      timestamp,
    }: Readonly<{ data: CallLinkRefreshJobData; timestamp: number }>,
    { attempt, log }: Readonly<{ attempt: number; log: LoggerType }>
  ): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
    const { roomId, deleteLocallyIfMissingOnCallingServer, source } = data;
    const logId = `callLinkRefreshJobQueue(${roomId}, source=${source}).run`;
    log.info(`${logId}: Starting`);

    const timeRemaining = timestamp + MAX_RETRY_TIME - Date.now();
    const shouldContinue = await commonShouldJobContinue({
      attempt,
      log,
      timeRemaining,
      skipWait: false,
    });
    if (!shouldContinue) {
      return undefined;
    }

    const existingCallLink = await DataReader.getCallLinkByRoomId(roomId);
    if (!existingCallLink) {
      log.warn(`${logId}: Call link missing locally, can't refresh`);
      return undefined;
    }

    let error: Error | undefined;
    const callLinkRootKey = CallLinkRootKey.parse(existingCallLink.rootKey);
    try {
      // This will either return the fresh call link state,
      // null (link deleted from server), or err (connection error)
      const freshCallLinkState = await calling.readCallLink(callLinkRootKey);
      if (freshCallLinkState != null) {
        log.info(`${logId}: Refreshed call link`);
        const callLink: CallLinkType = {
          ...existingCallLink,
          ...freshCallLinkState,
        };
        await DataWriter.updateCallLinkState(roomId, freshCallLinkState);
        window.reduxActions.calling.handleCallLinkUpdateLocal(callLink);
      } else if (deleteLocallyIfMissingOnCallingServer) {
        log.info(
          `${logId}: Call link not found on server and deleteLocallyIfMissingOnCallingServer; deleting local call link`
        );
        // This will leave a storage service record, and it's up to primary to delete it
        await DataWriter.deleteCallLinkAndHistory(roomId);
        window.reduxActions.calling.handleCallLinkDelete({ roomId });
      } else {
        log.info(`${logId}: Call link not found on server, ignoring`);
      }
    } catch (err) {
      error = err;
    }

    // Always throttle API calls to the calling server, but if shutting down and job
    // was successful then resolve and dequeue it on app shutdown, otherwise reject
    await sleeper.sleep(DEFAULT_SLEEP_TIME, `${logId}: Default sleep`, {
      resolveOnShutdown: error === undefined,
    });

    // Repropagate error so JobQueue handles it
    if (error) {
      throw error;
    }

    return undefined;
  }
}

export const callLinkRefreshJobQueue = new CallLinkRefreshJobQueue({
  maxAttempts: MAX_ATTEMPTS,
  queueType: 'call link refresh',
  store: jobQueueDatabaseStore,
});
