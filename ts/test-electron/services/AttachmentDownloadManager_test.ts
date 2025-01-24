// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable more/no-then */
/* eslint-disable @typescript-eslint/no-floating-promises */
import * as sinon from 'sinon';
import { assert } from 'chai';
import { omit } from 'lodash';

import * as MIME from '../../types/MIME';
import {
  AttachmentDownloadManager,
  AttachmentDownloadUrgency,
  runDownloadAttachmentJobInner,
  type NewAttachmentDownloadJobType,
} from '../../jobs/AttachmentDownloadManager';
import type { AttachmentDownloadJobType } from '../../types/AttachmentDownload';
import { DataReader, DataWriter } from '../../sql/Client';
import { MINUTE } from '../../util/durations';
import { type AttachmentType, AttachmentVariant } from '../../types/Attachment';
import { strictAssert } from '../../util/assert';
import { AttachmentDownloadSource } from '../../sql/Interface';
import { getAttachmentCiphertextLength } from '../../AttachmentCrypto';

function composeJob({
  messageId,
  receivedAt,
  attachmentOverrides,
  jobOverrides,
}: Pick<NewAttachmentDownloadJobType, 'messageId' | 'receivedAt'> & {
  attachmentOverrides?: Partial<AttachmentType>;
  jobOverrides?: Partial<AttachmentDownloadJobType>;
}): AttachmentDownloadJobType {
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
    ciphertextSize: getAttachmentCiphertextLength(size),
    contentType,
    active: false,
    attempts: 0,
    retryAfter: null,
    lastAttemptTimestamp: null,
    source: AttachmentDownloadSource.STANDARD,
    attachment: {
      contentType,
      size,
      digest: `digestFor${messageId}`,
      ...attachmentOverrides,
    },
    ...jobOverrides,
  };
}

describe('AttachmentDownloadManager/JobManager', () => {
  let downloadManager: AttachmentDownloadManager | undefined;
  let runJob: sinon.SinonStub;
  let sandbox: sinon.SinonSandbox;
  let clock: sinon.SinonFakeTimers;
  let isInCall: sinon.SinonStub;

  beforeEach(async () => {
    await DataWriter.removeAll();

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
      saveJob: DataWriter.saveAttachmentDownloadJob,
      shouldHoldOffOnStartingQueuedJobs: isInCall,
      runDownloadAttachmentJob: runJob,
      getRetryConfig: () => ({
        maxAttempts: 5,
        backoffConfig: {
          multiplier: 2,
          firstBackoffs: [MINUTE],
          maxBackoffTime: 10 * MINUTE,
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
    await window.MessageCache.saveMessage(
      {
        id: job.messageId,
        type: 'incoming',
        sent_at: job.sentAt,
        timestamp: job.sentAt,
        received_at: job.receivedAt + 1,
        conversationId: 'convoId',
      },
      {
        forceSave: true,
      }
    );
    await downloadManager?.addJob({
      urgency,
      ...job,
    });
  }
  async function addJobs(
    num: number,
    jobOverrides?:
      | Partial<AttachmentDownloadJobType>
      | ((idx: number) => Partial<AttachmentDownloadJobType>)
  ): Promise<Array<AttachmentDownloadJobType>> {
    const jobs = new Array(num).fill(null).map((_, idx) =>
      composeJob({
        messageId: `message-${idx}`,
        receivedAt: idx,
        jobOverrides:
          typeof jobOverrides === 'function' ? jobOverrides(idx) : jobOverrides,
      })
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
              `${call.args[0].job.messageId}${call.args[0].job.attachmentType}.${call.args[0].job.digest}`
          )
      ),
      JSON.stringify(
        jobs.map(job => `${job.messageId}${job.attachmentType}.${job.digest}`)
      )
    );
  }

  async function flushSQLReads() {
    await DataWriter.getNextAttachmentDownloadJobs({ limit: 10 });
  }

  async function advanceTime(ms: number) {
    // When advancing the timers, we want to make sure any DB operations are completed
    // first. In cases like maybeStartJobs where we prevent re-entrancy, without this,
    // prior (unfinished) invocations can prevent subsequent calls after the clock is
    // ticked forward and make tests unreliable
    await flushSQLReads();
    const now = Date.now();
    while (Date.now() < now + ms) {
      // eslint-disable-next-line no-await-in-loop
      await clock.tickAsync(downloadManager?.tickInterval ?? 1000);
      // eslint-disable-next-line no-await-in-loop
      await flushSQLReads();
    }
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
    const allJobs = await DataWriter.getNextAttachmentDownloadJobs({
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

    runJob.callsFake(async ({ job }: { job: AttachmentDownloadJobType }) => {
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

    const retriedJob = await DataReader.getAttachmentDownloadJob(jobs[1]);
    const finishedJob = await DataReader.getAttachmentDownloadJob(jobs[0]);

    assert.isUndefined(finishedJob);
    assert.strictEqual(retriedJob?.attempts, 1);
    assert.isNumber(retriedJob?.retryAfter);

    await advanceTime(MINUTE);

    await job1Attempts[1].completed;
    assert.strictEqual(runJob.callCount, 3);
    await advanceTime(2 * MINUTE);

    await job1Attempts[2].completed;
    assert.strictEqual(runJob.callCount, 4);

    await advanceTime(4 * MINUTE);
    await job1Attempts[3].completed;
    assert.strictEqual(runJob.callCount, 5);

    await advanceTime(8 * MINUTE);
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
    assert.isUndefined(await DataReader.getAttachmentDownloadJob(jobs[1]));
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

    await advanceTime(2 * MINUTE);
    await attempts[2].completed;
    assert.strictEqual(runJob.callCount, 6);

    await advanceTime(4 * MINUTE);
    await attempts[3].completed;
    assert.strictEqual(runJob.callCount, 7);

    await advanceTime(8 * MINUTE);
    await attempts[4].completed;
    assert.strictEqual(runJob.callCount, 8);

    // Ensure it's been removed
    assert.isUndefined(await DataReader.getAttachmentDownloadJob(jobs[0]));
  });

  it('only selects backup_import jobs if the mediaDownload is not paused', async () => {
    await window.storage.put('backupMediaDownloadPaused', true);
    const jobs = await addJobs(6, idx => ({
      source:
        idx % 2 === 0
          ? AttachmentDownloadSource.BACKUP_IMPORT
          : AttachmentDownloadSource.STANDARD,
      digest: `digestFor${idx}`,
      attachment: {
        contentType: MIME.IMAGE_JPEG,
        size: 128,
        digest: `digestFor${idx}`,
        backupLocator: {
          mediaName: 'medianame',
        },
      },
    }));
    // make one of the backup job messages visible to test that code path as well
    downloadManager?.updateVisibleTimelineMessages(['message-0', 'message-1']);
    await downloadManager?.start();
    await waitForJobToBeCompleted(jobs[3]);
    assertRunJobCalledWith([jobs[1], jobs[5], jobs[3]]);
    await advanceTime((downloadManager?.tickInterval ?? MINUTE) * 5);
    assertRunJobCalledWith([jobs[1], jobs[5], jobs[3]]);

    // resume backups
    await window.storage.put('backupMediaDownloadPaused', false);
    await advanceTime((downloadManager?.tickInterval ?? MINUTE) * 5);
    assertRunJobCalledWith([
      jobs[1],
      jobs[5],
      jobs[3],
      jobs[0],
      jobs[4],
      jobs[2],
    ]);
  });
});

describe('AttachmentDownloadManager/runDownloadAttachmentJob', () => {
  let sandbox: sinon.SinonSandbox;
  let deleteDownloadData: sinon.SinonStub;
  let downloadAttachment: sinon.SinonStub;
  let processNewAttachment: sinon.SinonStub;
  const abortController = new AbortController();

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    downloadAttachment = sandbox.stub().returns({
      path: '/path/to/file',
      iv: Buffer.alloc(16),
      plaintextHash: 'plaintextHash',
      isReencryptableToSameDigest: true,
    });
    processNewAttachment = sandbox.stub().callsFake(attachment => attachment);
  });

  afterEach(async () => {
    sandbox.restore();
  });
  describe('visible message', () => {
    it('will only download full-size if attachment not from backup', async () => {
      const job = composeJob({
        messageId: '1',
        receivedAt: 1,
      });

      const result = await runDownloadAttachmentJobInner({
        job,
        isForCurrentlyVisibleMessage: true,
        abortSignal: abortController.signal,
        dependencies: {
          deleteDownloadData,
          downloadAttachment,
          processNewAttachment,
        },
      });

      assert.strictEqual(result.downloadedVariant, AttachmentVariant.Default);
      assert.strictEqual(downloadAttachment.callCount, 1);

      const downloadCallArgs = downloadAttachment.getCall(0).args[0];
      assert.deepStrictEqual(downloadCallArgs.attachment, job.attachment);
      assert.deepStrictEqual(
        downloadCallArgs.options.variant,
        AttachmentVariant.Default
      );
    });
    it('will download thumbnail if attachment is from backup', async () => {
      const job = composeJob({
        messageId: '1',
        receivedAt: 1,
        attachmentOverrides: {
          backupLocator: {
            mediaName: 'medianame',
          },
        },
      });

      const result = await runDownloadAttachmentJobInner({
        job,
        isForCurrentlyVisibleMessage: true,
        abortSignal: abortController.signal,
        dependencies: {
          deleteDownloadData,
          downloadAttachment,
          processNewAttachment,
        },
      });

      strictAssert(
        result.downloadedVariant === AttachmentVariant.ThumbnailFromBackup,
        'downloaded thumbnail'
      );
      assert.deepStrictEqual(
        omit(result.attachmentWithThumbnail, 'thumbnailFromBackup'),
        {
          contentType: MIME.IMAGE_PNG,
          size: 128,
          digest: 'digestFor1',
          backupLocator: { mediaName: 'medianame' },
        }
      );
      assert.equal(
        result.attachmentWithThumbnail.thumbnailFromBackup?.path,
        '/path/to/file'
      );
      assert.strictEqual(downloadAttachment.callCount, 1);

      const downloadCallArgs = downloadAttachment.getCall(0).args[0];
      assert.deepStrictEqual(downloadCallArgs.attachment, job.attachment);
      assert.deepStrictEqual(
        downloadCallArgs.options.variant,
        AttachmentVariant.ThumbnailFromBackup
      );
    });
    it('will download full size if thumbnail already backed up', async () => {
      const job = composeJob({
        messageId: '1',
        receivedAt: 1,
        attachmentOverrides: {
          backupLocator: {
            mediaName: 'medianame',
          },
          thumbnailFromBackup: {
            path: '/path/to/thumbnail',
          },
        },
      });

      const result = await runDownloadAttachmentJobInner({
        job,
        isForCurrentlyVisibleMessage: true,
        abortSignal: abortController.signal,
        dependencies: {
          deleteDownloadData,
          downloadAttachment,
          processNewAttachment,
        },
      });
      assert.strictEqual(result.downloadedVariant, AttachmentVariant.Default);
      assert.strictEqual(downloadAttachment.callCount, 1);

      const downloadCallArgs = downloadAttachment.getCall(0).args[0];
      assert.deepStrictEqual(downloadCallArgs.attachment, job.attachment);
      assert.deepStrictEqual(
        downloadCallArgs.options.variant,
        AttachmentVariant.Default
      );
    });

    it('will attempt to download full size if thumbnail fails', async () => {
      downloadAttachment = sandbox.stub().callsFake(() => {
        throw new Error('error while downloading');
      });

      const job = composeJob({
        messageId: '1',
        receivedAt: 1,
        attachmentOverrides: {
          backupLocator: {
            mediaName: 'medianame',
          },
        },
      });

      await assert.isRejected(
        runDownloadAttachmentJobInner({
          job,
          isForCurrentlyVisibleMessage: true,
          abortSignal: abortController.signal,
          dependencies: {
            deleteDownloadData,
            downloadAttachment,
            processNewAttachment,
          },
        })
      );

      assert.strictEqual(downloadAttachment.callCount, 2);

      const downloadCallArgs0 = downloadAttachment.getCall(0).args[0];
      assert.deepStrictEqual(downloadCallArgs0.attachment, job.attachment);
      assert.deepStrictEqual(
        downloadCallArgs0.options.variant,
        AttachmentVariant.ThumbnailFromBackup
      );

      const downloadCallArgs1 = downloadAttachment.getCall(1).args[0];
      assert.deepStrictEqual(downloadCallArgs1.attachment, job.attachment);
      assert.deepStrictEqual(
        downloadCallArgs1.options.variant,
        AttachmentVariant.Default
      );
    });
  });
  describe('message not visible', () => {
    it('will only download full-size if message not visible', async () => {
      const job = composeJob({
        messageId: '1',
        receivedAt: 1,
        attachmentOverrides: {
          backupLocator: {
            mediaName: 'medianame',
          },
        },
      });

      const result = await runDownloadAttachmentJobInner({
        job,
        isForCurrentlyVisibleMessage: false,
        abortSignal: abortController.signal,
        dependencies: {
          deleteDownloadData,
          downloadAttachment,
          processNewAttachment,
        },
      });
      assert.strictEqual(result.downloadedVariant, AttachmentVariant.Default);
      assert.strictEqual(downloadAttachment.callCount, 1);

      const downloadCallArgs = downloadAttachment.getCall(0).args[0];
      assert.deepStrictEqual(downloadCallArgs.attachment, job.attachment);
      assert.deepStrictEqual(
        downloadCallArgs.options.variant,
        AttachmentVariant.Default
      );
    });
    it('will fallback to thumbnail if main download fails and backuplocator exists', async () => {
      downloadAttachment = sandbox.stub().callsFake(({ options }) => {
        if (options.variant === AttachmentVariant.Default) {
          throw new Error('error while downloading');
        }
        return {
          path: '/path/to/thumbnail',
          iv: Buffer.alloc(16),
          plaintextHash: 'plaintextHash',
        };
      });

      const job = composeJob({
        messageId: '1',
        receivedAt: 1,
        attachmentOverrides: {
          backupLocator: {
            mediaName: 'medianame',
          },
        },
      });

      const result = await runDownloadAttachmentJobInner({
        job,
        isForCurrentlyVisibleMessage: false,
        abortSignal: abortController.signal,
        dependencies: {
          deleteDownloadData,
          downloadAttachment,
          processNewAttachment,
        },
      });
      assert.strictEqual(
        result.downloadedVariant,
        AttachmentVariant.ThumbnailFromBackup
      );
      assert.strictEqual(downloadAttachment.callCount, 2);

      const downloadCallArgs0 = downloadAttachment.getCall(0).args[0];
      assert.deepStrictEqual(downloadCallArgs0.attachment, job.attachment);
      assert.deepStrictEqual(
        downloadCallArgs0.options.variant,
        AttachmentVariant.Default
      );

      const downloadCallArgs1 = downloadAttachment.getCall(1).args[0];
      assert.deepStrictEqual(downloadCallArgs1.attachment, job.attachment);
      assert.deepStrictEqual(
        downloadCallArgs1.options.variant,
        AttachmentVariant.ThumbnailFromBackup
      );
    });

    it("won't fallback to thumbnail if main download fails and no backup locator", async () => {
      downloadAttachment = sandbox.stub().callsFake(({ options }) => {
        if (options.variant === AttachmentVariant.Default) {
          throw new Error('error while downloading');
        }
        return {
          path: '/path/to/thumbnail',
          iv: Buffer.alloc(16),
          plaintextHash: 'plaintextHash',
        };
      });

      const job = composeJob({
        messageId: '1',
        receivedAt: 1,
      });

      await assert.isRejected(
        runDownloadAttachmentJobInner({
          job,
          isForCurrentlyVisibleMessage: false,
          abortSignal: abortController.signal,
          dependencies: {
            deleteDownloadData,
            downloadAttachment,
            processNewAttachment,
          },
        })
      );

      assert.strictEqual(downloadAttachment.callCount, 1);

      const downloadCallArgs = downloadAttachment.getCall(0).args[0];
      assert.deepStrictEqual(downloadCallArgs.attachment, job.attachment);
      assert.deepStrictEqual(
        downloadCallArgs.options.variant,
        AttachmentVariant.Default
      );
    });
  });
});
