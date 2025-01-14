// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as z from 'zod';
import * as durations from '../util/durations';
import { strictAssert } from '../util/assert';
import { waitForOnline } from '../util/waitForOnline';
import { isDone as isDeviceLinked } from '../util/registration';
import type { LoggerType } from '../types/Logging';
import { aciSchema } from '../types/ServiceId';
import { map } from '../util/iterables';

import type { JOB_STATUS } from './JobQueue';
import { JobQueue } from './JobQueue';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore';
import { parseIntWithFallback } from '../util/parseIntWithFallback';
import type { WebAPIType } from '../textsecure/WebAPI';
import { HTTPError } from '../textsecure/Errors';
import { sleeper } from '../util/sleeper';
import { parseUnknown } from '../util/schemas';

const RETRY_WAIT_TIME = durations.MINUTE;
const RETRYABLE_4XX_FAILURE_STATUSES = new Set([
  404, 408, 410, 412, 413, 414, 417, 423, 424, 425, 426, 428, 429, 431, 449,
]);

const is4xxStatus = (code: number): boolean => code >= 400 && code <= 499;
const is5xxStatus = (code: number): boolean => code >= 500 && code <= 599;
const isRetriable4xxStatus = (code: number): boolean =>
  RETRYABLE_4XX_FAILURE_STATUSES.has(code);

const reportSpamJobDataSchema = z.object({
  aci: aciSchema,
  token: z.string().optional(),
  serverGuids: z.string().array().min(1).max(1000),
});

export type ReportSpamJobData = z.infer<typeof reportSpamJobDataSchema>;

export class ReportSpamJobQueue extends JobQueue<ReportSpamJobData> {
  #server?: WebAPIType;

  public initialize({ server }: { server: WebAPIType }): void {
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
      window.storage.onready(resolve);
    });

    if (!isDeviceLinked()) {
      log.info("reportSpamJobQueue: skipping this job because we're unlinked");
      return undefined;
    }

    await waitForOnline();

    const server = this.#server;
    strictAssert(server !== undefined, 'ReportSpamJobQueue not initialized');

    try {
      await Promise.all(
        map(serverGuids, serverGuid =>
          server.reportMessage({ senderAci, serverGuid, token })
        )
      );

      return undefined;
    } catch (err: unknown) {
      if (!(err instanceof HTTPError)) {
        throw err;
      }

      const code = parseIntWithFallback(err.code, -1);

      // This is an unexpected case, except for -1, which can happen for network failures.
      if (code < 400) {
        throw err;
      }

      if (code === 508) {
        log.info(
          'reportSpamJobQueue: server responded with 508. Giving up on this job'
        );
        return undefined;
      }

      if (isRetriable4xxStatus(code) || is5xxStatus(code)) {
        log.info(
          `reportSpamJobQueue: server responded with ${code} status code. Sleeping before our next attempt`
        );
        await sleeper.sleep(
          RETRY_WAIT_TIME,
          `reportSpamJobQueue: server responded with ${code} status code`
        );
        throw err;
      }

      if (is4xxStatus(code)) {
        log.error(
          `reportSpamJobQueue: server responded with ${code} status code. Giving up on this job`
        );
        return undefined;
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
