// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as z from 'zod';
import { ErrorCode, LibSignalErrorBase } from '@signalapp/libsignal-client';
import * as durations from '../util/durations/index.std.ts';
import { strictAssert } from '../util/assert.std.ts';
import { waitForOnline } from '../util/waitForOnline.dom.ts';
import { isDone as isDeviceLinked } from '../util/registration.preload.ts';
import type { LoggerType } from '../types/Logging.std.ts';
import { aciSchema } from '../types/ServiceId.std.ts';
import { map } from '../util/iterables.std.ts';

import type { JOB_STATUS } from './JobQueue.std.ts';
import { JobQueue } from './JobQueue.std.ts';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore.preload.ts';
import type { reportMessage, isOnline } from '../textsecure/WebAPI.preload.ts';
import { sleeper } from '../util/sleeper.std.ts';
import { parseUnknown } from '../util/schemas.std.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';

const RETRY_WAIT_TIME = durations.MINUTE;

const reportSpamJobDataSchema = z.object({
  aci: aciSchema,
  token: z.string().optional(),
  serverGuids: z.string().array().min(1).max(1000),
});

export type ReportSpamJobData = z.infer<typeof reportSpamJobDataSchema>;

type ServerType = Readonly<{
  reportMessage: typeof reportMessage;
  isOnline: typeof isOnline;
}>;

class ReportSpamJobQueue extends JobQueue<ReportSpamJobData> {
  #server?: ServerType;

  public initialize({ server }: { server: ServerType }): void {
    this.#server = server;
  }

  protected parseData(data: unknown): ReportSpamJobData {
    return parseUnknown(reportSpamJobDataSchema, data);
  }

  protected async run(
    { data }: Readonly<{ data: ReportSpamJobData }>,
    { log }: Readonly<{ log: LoggerType }>
  ): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
    const { aci: senderAci, token, serverGuids } = data;

    await new Promise<void>(resolve => {
      itemStorage.onready(resolve);
    });

    if (!isDeviceLinked()) {
      log.info("skipping this job because we're unlinked");
      return undefined;
    }

    const server = this.#server;
    strictAssert(server !== undefined, 'ReportSpamJobQueue not initialized');

    await waitForOnline({ server });

    try {
      await Promise.all(
        map(serverGuids, serverGuid =>
          server.reportMessage({ senderAci, serverGuid, token })
        )
      );

      return undefined;
    } catch (err: unknown) {
      if (
        err instanceof LibSignalErrorBase &&
        err.is(ErrorCode.RateLimitedError)
      ) {
        log.info('rate limited. Sleeping before our next attempt');
        await sleeper.sleep(
          err.retryAfterSecs * durations.SECOND,
          'reportSpamJobQueue: rate limited'
        );
      } else if (
        err instanceof LibSignalErrorBase &&
        (err.is(ErrorCode.IoError) || err.is(ErrorCode.ChatServiceInactive))
      ) {
        log.info('request failed. Sleeping before our next attempt');
        await sleeper.sleep(
          RETRY_WAIT_TIME,
          'reportSpamJobQueue: request failed'
        );
      }

      throw err;
    }
  }
}

export const reportSpamJobQueue = new ReportSpamJobQueue({
  store: jobQueueDatabaseStore,
  queueType: 'report spam',
  maxAttempts: 25,
});
