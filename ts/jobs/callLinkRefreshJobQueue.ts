// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as z from 'zod';
import PQueue from 'p-queue';
import { CallLinkRootKey } from '@signalapp/ringrtc';
import * as globalLogger from '../logging/log';
import type { LoggerType } from '../types/Logging';
import { exponentialBackoffMaxAttempts } from '../util/exponentialBackoff';
import type { ParsedJob, StoredJob } from './types';
import type { JOB_STATUS } from './JobQueue';
import { JobQueue } from './JobQueue';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore';
import { DAY, SECOND } from '../util/durations';
import { commonShouldJobContinue } from './helpers/commonShouldJobContinue';
import { DataReader, DataWriter } from '../sql/Client';
import type { CallLinkType, PendingCallLinkType } from '../types/CallLink';
import { calling } from '../services/calling';
import { sleeper } from '../util/sleeper';
import { parseUnknown } from '../util/schemas';
import { getRoomIdFromRootKey } from '../util/callLinksRingrtc';
import { toCallHistoryFromUnusedCallLink } from '../util/callLinks';
import type { StorageServiceFieldsType } from '../sql/Interface';

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
  #parallelQueue = new PQueue({ concurrency: MAX_PARALLEL_JOBS });
  readonly #pendingCallLinks = new Map<string, PendingCallLinkType>();

  protected override getQueues(): ReadonlySet<PQueue> {
    return new Set([this.#parallelQueue]);
  }

  protected override getInMemoryQueue(
    _parsedJob: ParsedJob<CallLinkRefreshJobData>
  ): PQueue {
    return this.#parallelQueue;
  }

  protected parseData(data: unknown): CallLinkRefreshJobData {
    return parseUnknown(callLinkRefreshJobDataSchema, data);
  }

  // Called for every job; wrap it to save pending storage data
  protected override async enqueueStoredJob(
    storedJob: Readonly<StoredJob>
  ): Promise<void> {
    let parsedData: CallLinkRefreshJobData | undefined;
    try {
      parsedData = this.parseData(storedJob.data);
    } catch {
      // No need to err, it will fail below during super
    }
    const {
      storageID,
      storageVersion,
      storageUnknownFields,
      rootKey,
      adminKey,
    } = parsedData ?? {};
    if (storageID && storageVersion && rootKey) {
      this.#pendingCallLinks.set(rootKey, {
        rootKey,
        adminKey: adminKey ?? null,
        storageID: storageID ?? undefined,
        storageVersion: storageVersion ?? undefined,
        storageUnknownFields,
        storageNeedsSync: false,
      });
    }

    await super.enqueueStoredJob(storedJob);

    if (rootKey) {
      this.#pendingCallLinks.delete(rootKey);
    }
  }

  // Return pending call links with storageIDs and versions. They're pending because
  // depending on the refresh result, we will create either CallLinks or DefunctCallLinks,
  // and we'll save storageID and version onto those records.
  public getPendingAdminCallLinks(): ReadonlyArray<PendingCallLinkType> {
    return Array.from(this.#pendingCallLinks.values()).filter(
      callLink => callLink.adminKey != null
    );
  }

  public hasPendingCallLink(rootKey: string): boolean {
    return this.#pendingCallLinks.has(rootKey);
  }

  // If a new version of storage is uploaded before we get a chance to refresh the
  // call link, then we need to refresh pending storage fields so when the job
  // completes it will save with the latest storage fields.
  public updatePendingCallLinkStorageFields(
    rootKey: string,
    storageFields: StorageServiceFieldsType
  ): void {
    const existingStorageFields = this.#pendingCallLinks.get(rootKey);
    if (!existingStorageFields) {
      globalLogger.warn(
        'callLinkRefreshJobQueue.updatePendingCallLinkStorageFields: unknown rootKey'
      );
      return;
    }

    this.#pendingCallLinks.set(rootKey, {
      ...existingStorageFields,
      ...storageFields,
    });
  }

  protected getPendingCallLinkStorageFields(
    storageID: string,
    jobData: CallLinkRefreshJobData
  ): StorageServiceFieldsType | undefined {
    const storageFields = this.#pendingCallLinks.get(storageID);
    if (storageFields) {
      return {
        storageID: storageFields.storageID,
        storageVersion: storageFields.storageVersion,
        storageUnknownFields: storageFields.storageUnknownFields,
        storageNeedsSync: storageFields.storageNeedsSync,
      };
    }

    return {
      storageID: jobData.storageID ?? undefined,
      storageVersion: jobData.storageVersion ?? undefined,
      storageUnknownFields: jobData.storageUnknownFields ?? undefined,
      storageNeedsSync: false,
    };
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
          const { adminKey } = data;
          // Refresh the latest storage fields, since they may have changed.
          const storageFields = this.getPendingCallLinkStorageFields(
            rootKey,
            data
          );
          const callLink: CallLinkType = {
            ...freshCallLinkState,
            roomId,
            rootKey,
            adminKey: adminKey ?? null,
            ...storageFields,
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
        // Refresh the latest storage fields, since they may have changed.
        const storageFields = this.getPendingCallLinkStorageFields(
          rootKey,
          data
        );
        await DataWriter.insertDefunctCallLink({
          roomId,
          rootKey,
          adminKey: data.adminKey ?? null,
          ...storageFields,
          storageNeedsSync: false,
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
