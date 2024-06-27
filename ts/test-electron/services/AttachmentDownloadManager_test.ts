// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable more/no-then */
/* eslint-disable @typescript-eslint/no-floating-promises */
import * as sinon from 'sinon';
import { assert } from 'chai';
import * as MIME from '../../types/MIME';

import {
  AttachmentDownloadManager,
  AttachmentDownloadUrgency,
  type NewAttachmentDownloadJobType,
} from '../../jobs/AttachmentDownloadManager';
import type { AttachmentDownloadJobType } from '../../types/AttachmentDownload';
import dataInterface from '../../sql/Client';
import { MINUTE } from '../../util/durations';
import { type AciString } from '../../types/ServiceId';

describe('AttachmentDownloadManager/JobManager', () => {
  let downloadManager: AttachmentDownloadManager | undefined;
  let runJob: sinon.SinonStub;
  let sandbox: sinon.SinonSandbox;
  let clock: sinon.SinonFakeTimers;
  let isInCall: sinon.SinonStub;

  function composeJob({
    messageId,
    receivedAt,
  }: Pick<
    NewAttachmentDownloadJobType,
    'messageId' | 'receivedAt'
  >): AttachmentDownloadJobType {
    const digest = `digestFor${messageId}`;
    const size = 128;
    const contentType = MIME.IMAGE_PNG;
    return {
      messageId,
      receivedAt,
      sentAt: receivedAt,
      attachmentType: 'attachment',
      digest,
      size,
      contentType,
      active: false,
      attempts: 0,
      retryAfter: null,
      lastAttemptTimestamp: null,
      attachment: {
        contentType,
        size,
        digest: `digestFor${messageId}`,
      },
    };
  }

  beforeEach(async () => {
    await dataInterface.removeAll();

    sandbox = sinon.createSandbox();
    clock = sandbox.useFakeTimers();

    isInCall = sandbox.stub().returns(false);
    runJob = sandbox.stub().callsFake(async () => {
      return new Promise<{ status: 'finished' | 'retry' }>(resolve => {
        Promise.resolve().then(() => {
          resolve({ status: 'finished' });
        });
      });
    });

    downloadManager = new AttachmentDownloadManager({
      ...AttachmentDownloadManager.defaultParams,
      shouldHoldOffOnStartingQueuedJobs: isInCall,
      runJob,
      getRetryConfig: () => ({
        maxAttempts: 5,
        backoffConfig: {
          multiplier: 5,
          firstBackoffs: [MINUTE],
          maxBackoffTime: 30 * MINUTE,
        },
      }),
    });
  });

  afterEach(async () => {
    await downloadManager?.stop();
    sandbox.restore();
  });

  async function addJob(
    job: AttachmentDownloadJobType,
    urgency: AttachmentDownloadUrgency
  ) {
    // Save message first to satisfy foreign key constraint
    await dataInterface.saveMessage(
      {
        id: job.messageId,
        type: 'incoming',
        sent_at: job.sentAt,
        timestamp: job.sentAt,
        received_at: job.receivedAt + 1,
        conversationId: 'convoId',
      },
      {
        ourAci: 'ourAci' as AciString,
        forceSave: true,
      }
    );
    await downloadManager?.addJob({
      ...job,
      urgency,
    });
  }
  async function addJobs(
    num: number
  ): Promise<Array<AttachmentDownloadJobType>> {
    const jobs = new Array(num)
      .fill(null)
      .map((_, idx) =>
        composeJob({ messageId: `message-${idx}`, receivedAt: idx })
      );
    for (const job of jobs) {
      // eslint-disable-next-line no-await-in-loop
      await addJob(job, AttachmentDownloadUrgency.STANDARD);
    }
    return jobs;
  }

  function waitForJobToBeStarted(job: AttachmentDownloadJobType) {
    return downloadManager?.waitForJobToBeStarted(job);
  }

  function waitForJobToBeCompleted(job: AttachmentDownloadJobType) {
    return downloadManager?.waitForJobToBeCompleted(job);
  }

  function assertRunJobCalledWith(jobs: Array<AttachmentDownloadJobType>) {
    return assert.strictEqual(
      JSON.stringify(
        runJob
          .getCalls()
          .map(
            call =>
              `${call.args[0].messageId}${call.args[0].attachmentType}.${call.args[0].digest}`
          )
      ),
      JSON.stringify(
        jobs.map(job => `${job.messageId}${job.attachmentType}.${job.digest}`)
      )
    );
  }

  async function advanceTime(ms: number) {
    // When advancing the timers, we want to make sure any DB operations are completed
    // first. In cases like maybeStartJobs where we prevent re-entrancy, without this,
    // prior (unfinished) invocations can prevent subsequent calls after the clock is
    // ticked forward and make tests unreliable
    await dataInterface.getAllItems();
    await clock.tickAsync(ms);
    await dataInterface.getAllItems();
  }

  function getPromisesForAttempts(
    job: AttachmentDownloadJobType,
    attempts: number
  ) {
    return new Array(attempts).fill(null).map((_, idx) => {
      return {
        started: waitForJobToBeStarted({ ...job, attempts: idx }),
        completed: waitForJobToBeCompleted({ ...job, attempts: idx }),
      };
    });
  }

  it('runs 3 jobs at a time in descending receivedAt order', async () => {
    const jobs = await addJobs(5);
    // Confirm they are saved to DB
    const allJobs = await dataInterface.getNextAttachmentDownloadJobs({
      limit: 100,
    });

    assert.strictEqual(allJobs.length, 5);
    assert.strictEqual(
      JSON.stringify(allJobs.map(job => job.messageId)),
      JSON.stringify([
        'message-4',
        'message-3',
        'message-2',
        'message-1',
        'message-0',
      ])
    );

    await downloadManager?.start();
    await waitForJobToBeStarted(jobs[2]);

    assert.strictEqual(runJob.callCount, 3);
    assertRunJobCalledWith([jobs[4], jobs[3], jobs[2]]);

    await waitForJobToBeStarted(jobs[0]);
    assert.strictEqual(runJob.callCount, 5);
    assertRunJobCalledWith([jobs[4], jobs[3], jobs[2], jobs[1], jobs[0]]);
  });

  it('runs a job immediately if urgency is IMMEDIATE', async () => {
    const jobs = await addJobs(6);
    await downloadManager?.start();

    const urgentJobForOldMessage = composeJob({
      messageId: 'message-urgent',
      receivedAt: 0,
    });

    await addJob(urgentJobForOldMessage, AttachmentDownloadUrgency.IMMEDIATE);

    await waitForJobToBeStarted(urgentJobForOldMessage);

    assert.strictEqual(runJob.callCount, 4);
    assertRunJobCalledWith([jobs[5], jobs[4], jobs[3], urgentJobForOldMessage]);

    await waitForJobToBeStarted(jobs[0]);
    assert.strictEqual(runJob.callCount, 7);
    assertRunJobCalledWith([
      jobs[5],
      jobs[4],
      jobs[3],
      urgentJobForOldMessage,
      jobs[2],
      jobs[1],
      jobs[0],
    ]);
  });

  it('prefers jobs for visible messages', async () => {
    const jobs = await addJobs(5);

    downloadManager?.updateVisibleTimelineMessages(['message-0', 'message-1']);

    await downloadManager?.start();

    await waitForJobToBeStarted(jobs[4]);
    assert.strictEqual(runJob.callCount, 3);
    assertRunJobCalledWith([jobs[0], jobs[1], jobs[4]]);

    await waitForJobToBeStarted(jobs[2]);
    assert.strictEqual(runJob.callCount, 5);
    assertRunJobCalledWith([jobs[0], jobs[1], jobs[4], jobs[3], jobs[2]]);
  });

  it("does not start a job if we're in a call", async () => {
    const jobs = await addJobs(5);

    isInCall.callsFake(() => true);

    await downloadManager?.start();
    await advanceTime(2 * MINUTE);
    assert.strictEqual(runJob.callCount, 0);

    isInCall.callsFake(() => false);

    await advanceTime(2 * MINUTE);
    await waitForJobToBeStarted(jobs[0]);
    assert.strictEqual(runJob.callCount, 5);
  });

  it('handles retries for failed', async () => {
    const jobs = await addJobs(2);
    const job0Attempts = getPromisesForAttempts(jobs[0], 1);
    const job1Attempts = getPromisesForAttempts(jobs[1], 5);

    runJob.callsFake(async (job: AttachmentDownloadJobType) => {
      return new Promise<{ status: 'finished' | 'retry' }>(resolve => {
        Promise.resolve().then(() => {
          if (job.messageId === jobs[0].messageId) {
            resolve({ status: 'finished' });
          } else {
            resolve({ status: 'retry' });
          }
        });
      });
    });

    await downloadManager?.start();

    await job0Attempts[0].completed;
    assert.strictEqual(runJob.callCount, 2);
    assertRunJobCalledWith([jobs[1], jobs[0]]);

    const retriedJob = await dataInterface.getAttachmentDownloadJob(jobs[1]);
    const finishedJob = await dataInterface.getAttachmentDownloadJob(jobs[0]);

    assert.isUndefined(finishedJob);
    assert.strictEqual(retriedJob?.attempts, 1);
    assert.isNumber(retriedJob?.retryAfter);

    await advanceTime(MINUTE);

    await job1Attempts[1].completed;
    assert.strictEqual(runJob.callCount, 3);
    await advanceTime(5 * MINUTE);

    await job1Attempts[2].completed;
    assert.strictEqual(runJob.callCount, 4);

    await advanceTime(25 * MINUTE);
    await job1Attempts[3].completed;
    assert.strictEqual(runJob.callCount, 5);

    await advanceTime(30 * MINUTE);
    await job1Attempts[4].completed;

    assert.strictEqual(runJob.callCount, 6);
    assertRunJobCalledWith([
      jobs[1],
      jobs[0],
      jobs[1],
      jobs[1],
      jobs[1],
      jobs[1],
    ]);

    // Ensure it's been removed after completed
    assert.isUndefined(await dataInterface.getAttachmentDownloadJob(jobs[1]));
  });

  it('will reset attempts if addJob is called again', async () => {
    const jobs = await addJobs(1);
    runJob.callsFake(async () => {
      return new Promise<{ status: 'finished' | 'retry' }>(resolve => {
        Promise.resolve().then(() => {
          resolve({ status: 'retry' });
        });
      });
    });

    let attempts = getPromisesForAttempts(jobs[0], 4);
    await downloadManager?.start();

    await attempts[0].completed;
    assert.strictEqual(runJob.callCount, 1);

    await advanceTime(1 * MINUTE);
    await attempts[1].completed;
    assert.strictEqual(runJob.callCount, 2);

    await advanceTime(5 * MINUTE);
    await attempts[2].completed;
    assert.strictEqual(runJob.callCount, 3);

    // add the same job again and it should retry ASAP and reset attempts
    attempts = getPromisesForAttempts(jobs[0], 5);
    await downloadManager?.addJob(jobs[0]);
    await attempts[0].completed;
    assert.strictEqual(runJob.callCount, 4);

    await advanceTime(1 * MINUTE);
    await attempts[1].completed;
    assert.strictEqual(runJob.callCount, 5);

    await advanceTime(5 * MINUTE);
    await attempts[2].completed;
    assert.strictEqual(runJob.callCount, 6);

    await advanceTime(25 * MINUTE);
    await attempts[3].completed;
    assert.strictEqual(runJob.callCount, 7);

    await advanceTime(30 * MINUTE);
    await attempts[4].completed;
    assert.strictEqual(runJob.callCount, 8);

    // Ensure it's been removed
    assert.isUndefined(await dataInterface.getAttachmentDownloadJob(jobs[0]));
  });
});
