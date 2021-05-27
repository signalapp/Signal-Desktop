// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as z from 'zod';
import * as moment from 'moment';
import { waitForOnline } from '../util/waitForOnline';
import { isDone as isDeviceLinked } from '../util/registration';
import * as log from '../logging/log';
import { connectToServerWithStoredCredentials } from '../util/connectToServerWithStoredCredentials';
import { map } from '../util/iterables';
import { sleep } from '../util/sleep';

import { JobQueue } from './JobQueue';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore';
import { parseIntWithFallback } from '../util/parseIntWithFallback';

const RETRY_WAIT_TIME = moment.duration(1, 'minute').asMilliseconds();
const RETRYABLE_4XX_FAILURE_STATUSES = new Set([
  404,
  408,
  410,
  412,
  413,
  414,
  417,
  423,
  424,
  425,
  426,
  428,
  429,
  431,
  449,
]);

const is4xxStatus = (code: number): boolean => code >= 400 && code <= 499;
const is5xxStatus = (code: number): boolean => code >= 500 && code <= 599;
const isRetriable4xxStatus = (code: number): boolean =>
  RETRYABLE_4XX_FAILURE_STATUSES.has(code);

const reportSpamJobDataSchema = z.object({
  e164: z.string().min(1),
  serverGuids: z.string().array().min(1).max(1000),
});

export type ReportSpamJobData = z.infer<typeof reportSpamJobDataSchema>;

export const reportSpamJobQueue = new JobQueue<ReportSpamJobData>({
  store: jobQueueDatabaseStore,

  queueType: 'report spam',

  maxAttempts: 25,

  parseData(data: unknown): ReportSpamJobData {
    return reportSpamJobDataSchema.parse(data);
  },

  async run({ data }: Readonly<{ data: ReportSpamJobData }>): Promise<void> {
    const { e164, serverGuids } = data;

    await new Promise<void>(resolve => {
      window.storage.onready(resolve);
    });

    if (!isDeviceLinked()) {
      log.info("reportSpamJobQueue: skipping this job because we're unlinked");
      return;
    }

    await waitForOnline(window.navigator, window);

    const server = connectToServerWithStoredCredentials(
      window.WebAPI,
      window.storage
    );

    try {
      await Promise.all(
        map(serverGuids, serverGuid => server.reportMessage(e164, serverGuid))
      );
    } catch (err: unknown) {
      if (!(err instanceof Error)) {
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
        return;
      }

      if (isRetriable4xxStatus(code) || is5xxStatus(code)) {
        log.info(
          `reportSpamJobQueue: server responded with ${code} status code. Sleeping before our next attempt`
        );
        await sleep(RETRY_WAIT_TIME);
        throw err;
      }

      if (is4xxStatus(code)) {
        log.error(
          `reportSpamJobQueue: server responded with ${code} status code. Giving up on this job`
        );
        return;
      }

      throw err;
    }
  },
});
