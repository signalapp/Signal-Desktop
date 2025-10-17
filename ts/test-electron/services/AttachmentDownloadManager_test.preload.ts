// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable more/no-then */
/* eslint-disable @typescript-eslint/no-floating-promises */
import * as sinon from 'sinon';
import { assert } from 'chai';
import lodash from 'lodash';
import type { StatsFs } from 'node:fs';

import * as MIME from '../../types/MIME.std.js';
import {
  AttachmentDownloadManager,
  runDownloadAttachmentJob,
  runDownloadAttachmentJobInner,
  type NewAttachmentDownloadJobType,
} from '../../jobs/AttachmentDownloadManager.preload.js';
import {
  type AttachmentDownloadJobType,
  AttachmentDownloadUrgency,
  MediaTier,
} from '../../types/AttachmentDownload.std.js';
import { DataReader, DataWriter } from '../../sql/Client.preload.js';
import { DAY, MINUTE, MONTH } from '../../util/durations/index.std.js';
import {
  type AttachmentType,
  AttachmentVariant,
} from '../../types/Attachment.std.js';
import { strictAssert } from '../../util/assert.std.js';
import type { downloadAttachment as downloadAttachmentUtil } from '../../util/downloadAttachment.preload.js';
import { AttachmentDownloadSource } from '../../sql/Interface.std.js';
import { generateAttachmentKeys } from '../../AttachmentCrypto.node.js';
import { getAttachmentCiphertextSize } from '../../util/AttachmentCrypto.std.js';
import { MEBIBYTE } from '../../types/AttachmentSize.std.js';
import { generateAci } from '../../types/ServiceId.std.js';
import { toBase64, toHex } from '../../Bytes.std.js';
import { getRandomBytes } from '../../Crypto.node.js';
import { JobCancelReason } from '../../jobs/types.std.js';
import {
  explodePromise,
  type ExplodePromiseResultType,
} from '../../util/explodePromise.std.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

const { omit } = lodash;

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
  const plaintextHash = toHex(getRandomBytes(32));
  const size = 128;
  const contentType = MIME.IMAGE_PNG;
  return {
    messageId,
    receivedAt,
    sentAt: receivedAt,
    attachmentType: 'attachment',
    attachmentSignature: `${digest}.${plaintextHash}`,
    size,
    ciphertextSize: getAttachmentCiphertextSize({
      unpaddedPlaintextSize: size,
      mediaTier: MediaTier.STANDARD,
    }),
    contentType,
    active: false,
    attempts: 0,
    retryAfter: null,
    lastAttemptTimestamp: null,
    originalSource: jobOverrides?.source ?? AttachmentDownloadSource.STANDARD,
    source: AttachmentDownloadSource.STANDARD,
    attachment: {
      contentType,
      size,
      digest,
      plaintextHash,
      key: toBase64(generateAttachmentKeys()),
      ...attachmentOverrides,
    },
    ...jobOverrides,
  };
}

// node-fetch does not export AbortError as a constructor, so we copy it here
class AbortError extends Error {
  readonly type = 'aborted';
  override name = 'AbortError';
}

describe('AttachmentDownloadManager', () => {
  let downloadManager: AttachmentDownloadManager | undefined;
  let runJob: sinon.SinonStub<
    Parameters<typeof runDownloadAttachmentJob>,
    ReturnType<typeof runDownloadAttachmentJob>
  >;
  let sandbox: sinon.SinonSandbox;
  let clock: sinon.SinonFakeTimers;
  let hasMediaBackups: sinon.SinonStub;
  let isInCall: sinon.SinonStub;
  let onLowDiskSpaceBackupImport: sinon.SinonStub;
  let statfs: sinon.SinonStub;

  beforeEach(async () => {
    await DataWriter.removeAll();
    await itemStorage.user.setAciAndDeviceId(generateAci(), 1);

    sandbox = sinon.createSandbox();
    clock = sandbox.useFakeTimers();

    hasMediaBackups = sandbox.stub().returns(true);
    isInCall = sandbox.stub().returns(false);
    onLowDiskSpaceBackupImport = sandbox
      .stub()
      .callsFake(async () =>
        itemStorage.put('backupMediaDownloadPaused', true)
      );
    runJob = sandbox
      .stub<
        Parameters<typeof runDownloadAttachmentJob>,
        ReturnType<typeof runDownloadAttachmentJob>
      >()
      .callsFake(async () => {
        return new Promise<{ status: 'finished' | 'retry' }>(resolve => {
          Promise.resolve().then(() => {
            resolve({ status: 'finished' });
          });
        });
      });
    statfs = sandbox.stub().callsFake(() =>
      Promise.resolve({
        bavail: 100_000_000_000,
        bsize: 100,
      } as StatsFs)
    );

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
      onLowDiskSpaceBackupImport,
      hasMediaBackups,
      getMessageQueueTime: () => 45 * DAY,
      statfs,
    });
  });

  afterEach(async () => {
    await downloadManager?.stop();
    sandbox.restore();
    await DataWriter.removeAll();
    await itemStorage.fetch();
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
      isManualDownload: Boolean(job.isManualDownload),
    });
  }
  async function addJobs(
    num: number,
    jobOverrides?:
      | Partial<AttachmentDownloadJobType>
      | ((idx: number) => Partial<AttachmentDownloadJobType>),
    attachmentOverrides?: Partial<AttachmentType>
  ): Promise<Array<AttachmentDownloadJobType>> {
    const jobs = new Array(num).fill(null).map((_, idx) =>
      composeJob({
        messageId: `message-${idx}`,
        receivedAt: idx,
        jobOverrides:
          typeof jobOverrides === 'function' ? jobOverrides(idx) : jobOverrides,
        attachmentOverrides,
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
              `${call.args[0].job.messageId}${call.args[0].job.attachmentType}.${call.args[0].job.attachmentSignature}`
          )
      ),
      JSON.stringify(
        jobs.map(
          job =>
            `${job.messageId}${job.attachmentType}.${job.attachmentSignature}`
        )
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

  it('triggers onLowDiskSpace for backup import jobs', async () => {
    const jobs = await addJobs(1, _idx => ({
      source: AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA,
    }));

    const jobAttempts = getPromisesForAttempts(jobs[0], 2);

    statfs.callsFake(() => Promise.resolve({ bavail: 0, bsize: 8 }));

    await downloadManager?.start();
    await jobAttempts[0].completed;

    assert.strictEqual(runJob.callCount, 0);
    assert.strictEqual(onLowDiskSpaceBackupImport.callCount, 1);
    assert.isTrue(itemStorage.get('backupMediaDownloadPaused'));

    statfs.callsFake(() =>
      Promise.resolve({ bavail: 100_000_000_000, bsize: 8 })
    );
    await itemStorage.put('backupMediaDownloadPaused', false);

    await advanceTime(2 * MINUTE);
    assert.strictEqual(runJob.callCount, 1);
    await jobAttempts[1].completed;
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

    const retriedJob = await DataReader._getAttachmentDownloadJob(jobs[1]);
    const finishedJob = await DataReader._getAttachmentDownloadJob(jobs[0]);

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
    assert.isUndefined(await DataReader._getAttachmentDownloadJob(jobs[1]));
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
    await downloadManager?.addJob({
      ...jobs[0],
      isManualDownload: Boolean(jobs[0].isManualDownload),
    });
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
    assert.isUndefined(await DataReader._getAttachmentDownloadJob(jobs[0]));
  });

  it('only selects backup_import jobs if the mediaDownload is not paused', async () => {
    await itemStorage.put('backupMediaDownloadPaused', true);

    const jobs = await addJobs(6, idx => ({
      source:
        idx % 2 === 0
          ? AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA
          : AttachmentDownloadSource.STANDARD,
    }));
    // make one of the backup job messages visible to test that code path as well
    downloadManager?.updateVisibleTimelineMessages(['message-0', 'message-1']);
    await downloadManager?.start();
    await waitForJobToBeCompleted(jobs[3]);
    assertRunJobCalledWith([jobs[1], jobs[5], jobs[3]]);
    await advanceTime((downloadManager?.tickInterval ?? MINUTE) * 5);
    assertRunJobCalledWith([jobs[1], jobs[5], jobs[3]]);

    // resume backups
    await itemStorage.put('backupMediaDownloadPaused', false);
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

  it('retries backup job immediately if retryAfters are reset', async () => {
    strictAssert(downloadManager, 'must exist');
    const jobs = await addJobs(1, {
      source: AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA,
    });
    const jobAttempts = getPromisesForAttempts(jobs[0], 2);

    runJob.callsFake(async () => {
      return new Promise<{ status: 'finished' | 'retry' }>(resolve => {
        Promise.resolve().then(() => {
          resolve({ status: 'retry' });
        });
      });
    });

    await downloadManager?.start();
    await jobAttempts[0].completed;
    assertRunJobCalledWith([jobs[0]]);

    await DataWriter.resetBackupAttachmentDownloadJobsRetryAfter();
    await downloadManager.start();

    await jobAttempts[1].completed;
  });

  it('retries job with updated job if provided', async () => {
    strictAssert(downloadManager, 'must exist');
    const job = (
      await addJobs(1, {
        source: AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA,
      })
    )[0];
    const jobAttempts = getPromisesForAttempts(job, 3);

    runJob.callsFake(async args => {
      return new Promise(resolve => {
        Promise.resolve().then(() => {
          resolve({
            status: 'retry',
            updatedJob: {
              ...args.job,
              attachment: { ...job.attachment, caption: 'retried' },
            },
          });
        });
      });
    });

    await downloadManager?.start();
    await jobAttempts[0].completed;
    assertRunJobCalledWith([job]);
    await jobAttempts[1].completed;
    assert.deepStrictEqual(
      runJob.getCall(0).args[0].job.attachment,
      job.attachment
    );
    assert.deepStrictEqual(runJob.getCall(1).args[0].job.attachment, {
      ...job.attachment,
      caption: 'retried',
    });
  });

  describe('handles aborts properly', () => {
    let inflightRequestAbortController: AbortController;
    let downloadStarted: ExplodePromiseResultType<void>;

    beforeEach(() => {
      inflightRequestAbortController = new AbortController();
      downloadStarted = explodePromise<void>();
      runJob.callsFake((...args) =>
        runDownloadAttachmentJob({
          ...args[0],
          dependencies: {
            downloadAttachment: sandbox
              .stub()
              .callsFake(({ options: { abortSignal } }) => {
                return new Promise((_resolve, reject) => {
                  abortSignal.addEventListener('abort', () => {
                    reject(new AbortError('aborted by job'));
                  });

                  inflightRequestAbortController.signal.addEventListener(
                    'abort',
                    () => {
                      reject(
                        new AbortError(
                          'aborted by in-flight requests cancellation'
                        )
                      );
                    }
                  );
                  downloadStarted.resolve();
                });
              }),
            deleteDownloadData: sandbox.stub(),
            processNewAttachment: sandbox.stub(),
            runDownloadAttachmentJobInner,
          },
        })
      );
    });
    it('will retry a job when aborted b/c of shutdown', async () => {
      const jobs = await addJobs(1);
      const jobAttempts = getPromisesForAttempts(jobs[0], 2);

      await downloadManager?.start();
      await jobAttempts[0].started;
      await downloadStarted.promise;

      // Shutdown behavior
      downloadManager?.stop();
      inflightRequestAbortController.abort();

      await jobAttempts[0].completed;
      // Ensure it will be retried
      assert.strictEqual(
        (await DataReader._getAttachmentDownloadJob(jobs[0]))?.attempts,
        1
      );
      assert.strictEqual(runJob.callCount, 1);
    });
    it('will not retry a job if manually cancelled', async () => {
      const jobs = await addJobs(1);
      const jobAttempts = getPromisesForAttempts(jobs[0], 2);

      await downloadManager?.start();
      const downloadManagerIdled = downloadManager?.waitForIdle();

      await jobAttempts[0].started;
      await downloadStarted.promise;

      // user-cancelled behavior
      downloadManager?.cancelJobs(JobCancelReason.UserInitiated, () => true);

      await assert.isRejected(jobAttempts[0].completed as Promise<void>);
      await downloadManagerIdled;

      // Ensure it will not be retried
      assert.isUndefined(await DataReader._getAttachmentDownloadJob(jobs[0]));
      assert.strictEqual(runJob.callCount, 1);
    });
  });

  describe('will drop jobs from non-media backup imports that are old', () => {
    it('will not queue attachments older than 90 days (2 * message queue time)', async () => {
      await addJobs(
        1,
        {
          source: AttachmentDownloadSource.BACKUP_IMPORT_NO_MEDIA,
        },
        { uploadTimestamp: Date.now() - 4 * MONTH }
      );

      const savedJobs = await DataWriter.getNextAttachmentDownloadJobs({
        limit: 100,
      });
      assert.strictEqual(savedJobs.length, 0);
    });
    it('will queue old attachments with media backups on', async () => {
      hasMediaBackups.returns(true);
      await addJobs(
        1,
        {
          source: AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA,
        },
        { uploadTimestamp: Date.now() - 4 * MONTH }
      );

      const savedJobs = await DataWriter.getNextAttachmentDownloadJobs({
        limit: 100,
      });
      assert.strictEqual(savedJobs.length, 1);
    });
    it('will queue old local backup attachments', async () => {
      hasMediaBackups.returns(false);
      await addJobs(
        1,
        {
          source: AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA,
        },
        {
          uploadTimestamp: Date.now() - 4 * MONTH,
          localBackupPath: 'localBackupPath',
          localKey: toBase64(generateAttachmentKeys()),
        }
      );

      const savedJobs = await DataWriter.getNextAttachmentDownloadJobs({
        limit: 100,
      });
      assert.strictEqual(savedJobs.length, 1);
    });
    it('will fallback to sentAt if uploadTimestamp is falsy', async () => {
      hasMediaBackups.returns(false);
      await addJobs(
        1,
        {
          source: AttachmentDownloadSource.BACKUP_IMPORT_NO_MEDIA,
          sentAt: Date.now() - 4 * MONTH,
        },
        { uploadTimestamp: 0 }
      );

      const savedJobs = await DataWriter.getNextAttachmentDownloadJobs({
        limit: 100,
      });
      assert.strictEqual(savedJobs.length, 0);
    });
  });
});

describe('AttachmentDownloadManager.runDownloadAttachmentJobInner', () => {
  let sandbox: sinon.SinonSandbox;
  let deleteDownloadData: sinon.SinonStub;
  let downloadAttachment: sinon.SinonStub;
  let processNewAttachment: sinon.SinonStub;
  const abortController = new AbortController();

  const downloadedAttachment: Awaited<
    ReturnType<typeof downloadAttachmentUtil>
  > = {
    path: '/path/to/file',
    digest: 'digest',
    plaintextHash: 'plaintextHash',
    localKey: 'localKey',
    version: 2,
    size: 128,
  };

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    downloadAttachment = sandbox
      .stub()
      .returns(Promise.resolve(downloadedAttachment));

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
        attachmentOverrides: {
          plaintextHash: undefined,
        },
      });

      const result = await runDownloadAttachmentJobInner({
        job,
        isForCurrentlyVisibleMessage: true,
        hasMediaBackups: true,
        abortSignal: abortController.signal,
        maxAttachmentSizeInKib: 100 * MEBIBYTE,
        maxTextAttachmentSizeInKib: 2 * MEBIBYTE,
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

    it('will download thumbnail first if attachment is from backup', async () => {
      const job = composeJob({
        messageId: '1',
        receivedAt: 1,
      });

      downloadAttachment = sandbox.stub().callsFake(({ options }) => {
        if (options.variant === AttachmentVariant.ThumbnailFromBackup) {
          return Promise.resolve(downloadedAttachment);
        }
        throw new Error('error while downloading');
      });

      const result = await runDownloadAttachmentJobInner({
        job,
        isForCurrentlyVisibleMessage: true,
        hasMediaBackups: true,
        abortSignal: abortController.signal,
        maxAttachmentSizeInKib: 100 * MEBIBYTE,
        maxTextAttachmentSizeInKib: 2 * MEBIBYTE,
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
        job.attachment
      );
      assert.equal(
        result.attachmentWithThumbnail.thumbnailFromBackup?.path,
        '/path/to/file'
      );
      assert.strictEqual(downloadAttachment.callCount, 2);

      const firstDownloadCallArgs = downloadAttachment.getCall(0).args[0];
      assert.deepStrictEqual(firstDownloadCallArgs.attachment, job.attachment);
      assert.deepStrictEqual(
        firstDownloadCallArgs.options.variant,
        AttachmentVariant.ThumbnailFromBackup
      );

      const secondDownloadCallArgs = downloadAttachment.getCall(1).args[0];
      assert.deepStrictEqual(
        secondDownloadCallArgs.options.variant,
        AttachmentVariant.Default
      );
    });

    it('will download full size if backup thumbnail already downloaded', async () => {
      const job = composeJob({
        messageId: '1',
        receivedAt: 1,
        attachmentOverrides: {
          thumbnailFromBackup: {
            path: '/path/to/thumbnail',
            size: 128,
            contentType: MIME.IMAGE_JPEG,
          },
        },
      });

      const result = await runDownloadAttachmentJobInner({
        job,
        isForCurrentlyVisibleMessage: true,
        hasMediaBackups: true,
        abortSignal: abortController.signal,
        maxAttachmentSizeInKib: 100 * MEBIBYTE,
        maxTextAttachmentSizeInKib: 2 * MEBIBYTE,
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
      downloadAttachment = sandbox.stub().callsFake(({ options }) => {
        if (options.variant === AttachmentVariant.Default) {
          return Promise.resolve(downloadedAttachment);
        }
        throw new Error('error while downloading');
      });

      const job = composeJob({
        messageId: '1',
        receivedAt: 1,
      });

      const result = await runDownloadAttachmentJobInner({
        job,
        isForCurrentlyVisibleMessage: true,
        hasMediaBackups: true,
        abortSignal: abortController.signal,
        maxAttachmentSizeInKib: 100 * MEBIBYTE,
        maxTextAttachmentSizeInKib: 2 * MEBIBYTE,
        dependencies: {
          deleteDownloadData,
          downloadAttachment,
          processNewAttachment,
        },
      });
      assert.strictEqual(result.downloadedVariant, AttachmentVariant.Default);
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
      });

      const result = await runDownloadAttachmentJobInner({
        job,
        isForCurrentlyVisibleMessage: false,
        hasMediaBackups: true,
        abortSignal: abortController.signal,
        maxAttachmentSizeInKib: 100 * MEBIBYTE,
        maxTextAttachmentSizeInKib: 2 * MEBIBYTE,
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
    it('will fallback to thumbnail if main download fails and might exist on backup', async () => {
      downloadAttachment = sandbox.stub().callsFake(({ options }) => {
        if (options.variant === AttachmentVariant.Default) {
          throw new Error('error while downloading');
        }
        return downloadedAttachment;
      });

      const job = composeJob({
        messageId: '1',
        receivedAt: 1,
      });

      const result = await runDownloadAttachmentJobInner({
        job,
        isForCurrentlyVisibleMessage: false,
        hasMediaBackups: true,
        abortSignal: abortController.signal,
        maxAttachmentSizeInKib: 100 * MEBIBYTE,
        maxTextAttachmentSizeInKib: 2 * MEBIBYTE,
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

    it("won't fallback to thumbnail if main download fails and not on backup", async () => {
      downloadAttachment = sandbox.stub().callsFake(({ options }) => {
        if (options.variant === AttachmentVariant.Default) {
          throw new Error('error while downloading');
        }
        return {
          path: '/path/to/thumbnail',
          plaintextHash: 'plaintextHash',
          digest: 'digest',
        };
      });

      const job = composeJob({
        messageId: '1',
        receivedAt: 1,
        attachmentOverrides: {
          plaintextHash: undefined,
        },
      });

      await assert.isRejected(
        runDownloadAttachmentJobInner({
          job,
          isForCurrentlyVisibleMessage: false,
          hasMediaBackups: true,
          abortSignal: abortController.signal,
          maxAttachmentSizeInKib: 100 * MEBIBYTE,
          maxTextAttachmentSizeInKib: 2 * MEBIBYTE,
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
