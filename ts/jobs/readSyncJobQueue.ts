// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable class-methods-use-this */

import * as z from 'zod';
import * as moment from 'moment';
import { chunk } from 'lodash';
import { getSendOptions } from '../util/getSendOptions';
import { handleMessageSend } from '../util/handleMessageSend';
import { isNotNil } from '../util/isNotNil';
import { sleep } from '../util/sleep';
import {
  exponentialBackoffSleepTime,
  exponentialBackoffMaxAttempts,
} from '../util/exponentialBackoff';
import * as log from '../logging/log';
import { isDone as isDeviceLinked } from '../util/registration';
import { waitForOnline } from '../util/waitForOnline';
import { parseIntWithFallback } from '../util/parseIntWithFallback';

import { JobQueue } from './JobQueue';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore';

const CHUNK_SIZE = 100;

const MAX_RETRY_TIME = moment.duration(1, 'day').asMilliseconds();

const readSyncJobDataSchema = z.object({
  readSyncs: z.array(
    z.object({
      messageId: z.string().optional(),
      senderE164: z.string().optional(),
      senderUuid: z.string().optional(),
      timestamp: z.number(),
    })
  ),
});

export type ReadSyncJobData = z.infer<typeof readSyncJobDataSchema>;

export class ReadSyncJobQueue extends JobQueue<ReadSyncJobData> {
  protected parseData(data: unknown): ReadSyncJobData {
    return readSyncJobDataSchema.parse(data);
  }

  protected async run(
    { data, timestamp }: Readonly<{ data: ReadSyncJobData; timestamp: number }>,
    { attempt }: Readonly<{ attempt: number }>
  ): Promise<void> {
    const { readSyncs } = data;
    if (!readSyncs.length) {
      log.info(
        "readSyncJobQueue: skipping this job because there's nothing to sync"
      );
      return;
    }

    const maxJobAge = timestamp + MAX_RETRY_TIME;
    const timeRemaining = maxJobAge - Date.now();

    if (timeRemaining <= 0) {
      log.info("readSyncJobQueue: giving up because it's been too long");
      return;
    }

    try {
      await waitForOnline(window.navigator, window, { timeout: timeRemaining });
    } catch (err) {
      log.info("readSyncJobQueue: didn't come online in time, giving up");
      return;
    }

    await new Promise<void>(resolve => {
      window.storage.onready(resolve);
    });

    if (!isDeviceLinked()) {
      log.info("readSyncJobQueue: skipping this job because we're unlinked");
      return;
    }

    await sleep(exponentialBackoffSleepTime(attempt));

    const ourConversation = window.ConversationController.getOurConversationOrThrow();
    const sendOptions = await getSendOptions(ourConversation.attributes, {
      syncMessage: true,
    });

    try {
      await Promise.all(
        chunk(readSyncs, CHUNK_SIZE).map(batch => {
          const messageIds = batch.map(item => item.messageId).filter(isNotNil);

          return handleMessageSend(
            window.textsecure.messaging.syncReadMessages(batch, sendOptions),
            { messageIds, sendType: 'readSync' }
          );
        })
      );
    } catch (err: unknown) {
      if (!(err instanceof Error)) {
        throw err;
      }

      const code = parseIntWithFallback(err.code, -1);
      if (code === 508) {
        log.info(
          'readSyncJobQueue: server responded with 508. Giving up on this job'
        );
        return;
      }

      throw err;
    }
  }
}

export const readSyncJobQueue = new ReadSyncJobQueue({
  store: jobQueueDatabaseStore,

  queueType: 'read sync',

  maxAttempts: exponentialBackoffMaxAttempts(MAX_RETRY_TIME),
});
