// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { z } from 'zod';
import type { LoggerType } from '../types/Logging';
import { DataReader, DataWriter } from '../sql/Client';
import type { JOB_STATUS } from './JobQueue';
import { JobQueue } from './JobQueue';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore';
import { calling } from '../services/calling';
import { toLogFormat } from '../types/errors';

const callLinksDeleteJobData = z.object({
  source: z.string(),
});

type CallLinksDeleteJobData = z.infer<typeof callLinksDeleteJobData>;

export class CallLinksDeleteJobQueue extends JobQueue<CallLinksDeleteJobData> {
  protected parseData(data: unknown): CallLinksDeleteJobData {
    return callLinksDeleteJobData.parse(data);
  }

  protected async run(
    { data }: { data: CallLinksDeleteJobData },
    { attempt, log }: { attempt: number; log: LoggerType }
  ): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
    const { source } = data;
    const logId = `callLinksDeleteJobQueue(${source}, attempt=${attempt})`;
    const deletedCallLinks = await DataReader.getAllMarkedDeletedCallLinks();
    if (deletedCallLinks.length === 0) {
      log.info(`${logId}: no call links to delete`);
      return undefined;
    }
    log.info(`${logId}: deleting ${deletedCallLinks.length} call links`);
    const errors: Array<unknown> = [];
    await Promise.all(
      deletedCallLinks.map(async deletedCallLink => {
        try {
          // May 200 or 404 and that's fine
          // Sends a CallLinkUpdate with type set to DELETE
          await calling.deleteCallLink(deletedCallLink);
          await DataWriter.finalizeDeleteCallLink(deletedCallLink.roomId);
          log.info(`${logId}: deleted call link ${deletedCallLink.roomId}`);
        } catch (error) {
          log.error(
            `${logId}: failed to delete call link ${deletedCallLink.roomId}`,
            toLogFormat(error)
          );
          errors.push(error);
        }
      })
    );
    log.info(
      `${logId}: Deleted ${deletedCallLinks.length} call links, failed to delete ${errors.length} call links`
    );
    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        `Failed to delete ${errors.length} call links`
      );
    }
    return undefined;
  }
}

export const callLinksDeleteJobQueue = new CallLinksDeleteJobQueue({
  store: jobQueueDatabaseStore,
  queueType: 'callLinksDelete',
  maxAttempts: 25,
});
