// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import { omit } from 'lodash';

import { JobQueue } from './JobQueue';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore';
import { parseUnknown } from '../util/schemas';
import { DataReader } from '../sql/Client';

import type { JOB_STATUS } from './JobQueue';
import type { LoggerType } from '../types/Logging';
import { commonShouldJobContinue } from './helpers/commonShouldJobContinue';
import { DAY } from '../util/durations';
import { exponentialBackoffMaxAttempts } from '../util/exponentialBackoff';

const deleteDownloadsJobDataSchema = z.object({
  digest: z.string().optional(),
  downloadPath: z.string(),
  messageId: z.string(),
  plaintextHash: z.string().optional(),
});

type DeleteDownloadsJobData = z.infer<typeof deleteDownloadsJobDataSchema>;

const MAX_RETRY_TIME = DAY;
const MAX_ATTEMPTS = exponentialBackoffMaxAttempts(MAX_RETRY_TIME);

export class DeleteDownloadsJobQueue extends JobQueue<DeleteDownloadsJobData> {
  protected parseData(data: unknown): DeleteDownloadsJobData {
    return parseUnknown(deleteDownloadsJobDataSchema, data);
  }

  protected async run(
    {
      timestamp,
      data,
    }: Readonly<{ data: DeleteDownloadsJobData; timestamp: number }>,
    { attempt, log }: Readonly<{ attempt: number; log: LoggerType }>
  ): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
    await new Promise<void>(resolve => {
      window.storage.onready(resolve);
    });

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

    const { digest, downloadPath, messageId, plaintextHash } = data;

    const message = await DataReader.getMessageById(messageId);
    if (!message) {
      log?.warn('Message not found; attempting to delete download path.');
      await window.Signal.Migrations.deleteDownloadData(downloadPath);

      return undefined;
    }

    const { attachments } = message;
    const target = (attachments || []).find(attachment => {
      if (plaintextHash && attachment.plaintextHash === plaintextHash) {
        return true;
      }
      if (digest && attachment.digest === digest) {
        return true;
      }
      if (attachment.downloadPath === downloadPath) {
        return true;
      }

      return false;
    });
    if (!target) {
      log?.warn(
        'Target attachment not found; attempting to delete download path.'
      );
      await window.Signal.Migrations.deleteDownloadData(downloadPath);
      return undefined;
    }

    if (!target.path || target.pending) {
      log?.warn(
        'Target attachment is still downloading; Failing this job to try again later'
      );
      throw new Error('Attachment still downloading');
    }

    await window.Signal.Migrations.deleteDownloadData(downloadPath);

    const updatedMessage = {
      ...message,
      attachments: (attachments || []).map(attachment => {
        if (attachment !== target) {
          return attachment;
        }

        return omit(attachment, ['downloadPath', 'totalDownloaded']);
      }),
    };

    await window.MessageCache.saveMessage(updatedMessage);

    return undefined;
  }
}

export const deleteDownloadsJobQueue = new DeleteDownloadsJobQueue({
  store: jobQueueDatabaseStore,
  queueType: 'delete downloads',
  maxAttempts: MAX_ATTEMPTS,
});
