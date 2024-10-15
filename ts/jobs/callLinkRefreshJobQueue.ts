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
import { getRoomIdFromRootKey } from '../util/callLinksRingrtc';
import { toCallHistoryFromUnusedCallLink } from '../util/callLinks';

const MAX_RETRY_TIME = DAY;
const MAX_PARALLEL_JOBS = 10;
const MAX_ATTEMPTS = exponentialBackoffMaxAttempts(MAX_RETRY_TIME);
const DEFAULT_SLEEP_TIME = 20 * SECOND;

// Only rootKey is required. Other fields are only used if the call link doesn't
// exist locally, in order to create a call link. This is useful for storage sync when
// we download call link data, but we don't want to insert a record until
// the call link is confirmed valid on the calling server.
const callLinkRefreshJobDataSchema = z.object({
  rootKey: z.string(),
  adminKey: z.string().nullable().optional(),
  storageID: z.string().nullable().optional(),
  storageVersion: z.number().int().nullable().optional(),
  storageUnknownFields: z.instanceof(Uint8Array).nullable().optional(),
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
    const { rootKey, source } = data;
    const callLinkRootKey = CallLinkRootKey.parse(rootKey);
    const roomId = getRoomIdFromRootKey(callLinkRootKey);

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

    let error: Error | undefined;
    try {
      // This will either return the fresh call link state,
      // null (link deleted from server), or err (connection error)
      const freshCallLinkState = await calling.readCallLink(callLinkRootKey);
      const existingCallLink = await DataReader.getCallLinkByRoomId(roomId);

      if (freshCallLinkState != null) {
        if (existingCallLink) {
          log.info(`${logId}: Updating call link with fresh state`);
          const callLink: CallLinkType = {
            ...existingCallLink,
            ...freshCallLinkState,
          };
          await DataWriter.updateCallLinkState(roomId, freshCallLinkState);
          window.reduxActions.calling.handleCallLinkUpdateLocal(callLink);
        } else {
          log.info(`${logId}: Creating new call link`);
          const { adminKey, storageID, storageVersion, storageUnknownFields } =
            data;
          const callLink: CallLinkType = {
            ...freshCallLinkState,
            roomId,
            rootKey,
            adminKey: adminKey ?? null,
            storageID: storageID ?? undefined,
            storageVersion: storageVersion ?? undefined,
            storageUnknownFields,
            storageNeedsSync: false,
          };

          const callHistory = toCallHistoryFromUnusedCallLink(callLink);
          await Promise.all([
            DataWriter.insertCallLink(callLink),
            DataWriter.saveCallHistory(callHistory),
          ]);
          window.reduxActions.callHistory.addCallHistory(callHistory);
          window.reduxActions.calling.handleCallLinkUpdateLocal(callLink);
        }
      } else if (!existingCallLink) {
        // When the call link is missing from the server, and we don't have a local
        // call link record, that means we discovered a defunct link from storage service.
        // Save this state to DefunctCallLink.
        log.info(
          `${logId}: Call link not found on server but absent locally, saving DefunctCallLink`
        );
        await DataWriter.insertDefunctCallLink({
          roomId,
          rootKey,
          adminKey: data.adminKey ?? null,
        });
      } else {
        log.info(
          `${logId}: Call link not found on server but present locally, ignoring`
        );
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
