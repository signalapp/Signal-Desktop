// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging';
import { getJobsInQueue, insertJob } from '../Server';
import type { WritableDB } from '../Interface';
import { isRecord } from '../../util/isRecord';
import { isIterable } from '../../util/iterables';

export default function updateToSchemaVersion55(
  currentVersion: number,
  db: WritableDB,
  logger: LoggerType
): void {
  if (currentVersion >= 55) {
    return;
  }

  db.transaction(() => {
    const deleteJobsInQueue = db.prepare(
      'DELETE FROM jobs WHERE queueType = $queueType'
    );

    // First, make sure that report spam job data has e164 and serverGuids
    const reportSpamJobs = getJobsInQueue(db, 'report spam');
    deleteJobsInQueue.run({ queueType: 'report spam' });

    reportSpamJobs.forEach(job => {
      const { data, id } = job;

      if (!isRecord(data)) {
        logger.warn(
          `updateToSchemaVersion55: report spam queue job ${id} was missing valid data`
        );
        return;
      }

      const { e164, serverGuids } = data;
      if (typeof e164 !== 'string') {
        logger.warn(
          `updateToSchemaVersion55: report spam queue job ${id} had a non-string e164`
        );
        return;
      }

      if (!isIterable(serverGuids)) {
        logger.warn(
          `updateToSchemaVersion55: report spam queue job ${id} had a non-iterable serverGuids`
        );
        return;
      }

      const newJob = {
        ...job,
        queueType: 'report spam',
        data: {
          uuid: e164, // this looks odd, but they are both strings and interchangeable in the server API
          serverGuids,
        },
      };

      insertJob(db, newJob);
    });

    db.pragma('user_version = 55');
  })();
  logger.info('updateToSchemaVersion55: success!');
}
