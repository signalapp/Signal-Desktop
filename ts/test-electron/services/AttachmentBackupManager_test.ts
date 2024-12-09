// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as sinon from 'sinon';
import { assert } from 'chai';
import { join } from 'path';
import { createWriteStream } from 'fs';
import { ensureFile } from 'fs-extra';

import * as Bytes from '../../Bytes';
import {
  AttachmentBackupManager,
  FILE_NOT_FOUND_ON_TRANSIT_TIER_STATUS,
  runAttachmentBackupJob,
} from '../../jobs/AttachmentBackupManager';
import type {
  AttachmentBackupJobType,
  CoreAttachmentBackupJobType,
  StandardAttachmentBackupJobType,
  ThumbnailAttachmentBackupJobType,
} from '../../types/AttachmentBackup';
import { DataWriter } from '../../sql/Client';
import { getRandomBytes } from '../../Crypto';
import { APPLICATION_OCTET_STREAM, VIDEO_MP4 } from '../../types/MIME';
import { createName, getRelativePath } from '../../util/attachmentPath';
import { encryptAttachmentV2, generateKeys } from '../../AttachmentCrypto';
import { SECOND } from '../../util/durations';
import { HTTPError } from '../../textsecure/Errors';

const TRANSIT_CDN = 2;
const TRANSIT_CDN_FOR_NEW_UPLOAD = 42;
const BACKUP_CDN = 3;

const RELATIVE_ATTACHMENT_PATH = getRelativePath(createName());
const LOCAL_ENCRYPTION_KEYS = Bytes.toBase64(generateKeys());
const ATTACHMENT_SIZE = 188610;

describe('AttachmentBackupManager/JobManager', function attachmentBackupManager(this: Mocha.Suite) {
  this.timeout(10 * SECOND);
  let backupManager: AttachmentBackupManager | undefined;
  let runJob: sinon.SinonSpy;
  let backupMediaBatch: sinon.SinonStub;
  let backupsService = {};
  let encryptAndUploadAttachment: sinon.SinonStub;
  let sandbox: sinon.SinonSandbox;
  let clock: sinon.SinonFakeTimers;
  let isInCall: sinon.SinonStub;

  function composeJob(
    index: number,
    overrides: Partial<CoreAttachmentBackupJobType['data']> = {}
  ): StandardAttachmentBackupJobType {
    const mediaName = `mediaName${index}`;

    return {
      mediaName,
      type: 'standard',
      receivedAt: index,
      data: {
        path: RELATIVE_ATTACHMENT_PATH,
        contentType: VIDEO_MP4,
        keys: 'keys=',
        iv: 'iv==',
        digest: 'digest=',
        version: 2,
        localKey: LOCAL_ENCRYPTION_KEYS,
        transitCdnInfo: {
          cdnKey: 'transitCdnKey',
          cdnNumber: TRANSIT_CDN,
          uploadTimestamp: Date.now(),
        },
        size: ATTACHMENT_SIZE,
        ...overrides,
      },
    };
  }

  function composeThumbnailJob(
    index: number,
    overrides: Partial<ThumbnailAttachmentBackupJobType['data']> = {}
  ): ThumbnailAttachmentBackupJobType {
    const mediaName = `thumbnail${index}_thumbnail` as const;

    return {
      mediaName,
      type: 'thumbnail',
      receivedAt: index,
      data: {
        fullsizePath: RELATIVE_ATTACHMENT_PATH,
        fullsizeSize: ATTACHMENT_SIZE,
        contentType: VIDEO_MP4,
        version: 2,
        localKey: LOCAL_ENCRYPTION_KEYS,

        ...overrides,
      },
    };
  }

  before(async () => {
    const { getAbsoluteAttachmentPath } = window.Signal.Migrations;
    const absolutePath = getAbsoluteAttachmentPath(RELATIVE_ATTACHMENT_PATH);
    await ensureFile(absolutePath);
    await DataWriter.ensureFilePermissions();
    await encryptAttachmentV2({
      plaintext: {
        absolutePath: join(__dirname, '../../../fixtures/cat-gif.mp4'),
      },
      keys: Bytes.fromBase64(LOCAL_ENCRYPTION_KEYS),
      needIncrementalMac: false,
      sink: createWriteStream(absolutePath),
    });
  });

  beforeEach(async () => {
    await DataWriter.removeAll();

    await window.storage.put('masterKey', Bytes.toBase64(getRandomBytes(32)));
    await window.storage.put('backupMediaRootKey', getRandomBytes(32));

    sandbox = sinon.createSandbox();
    clock = sandbox.useFakeTimers();
    isInCall = sandbox.stub().returns(false);

    backupMediaBatch = sandbox
      .stub()
      .returns(Promise.resolve({ responses: [{ isSuccess: true, cdn: 3 }] }));

    backupsService = {
      credentials: {
        getHeadersForToday: () => Promise.resolve({}),
      },
      getBackupCdnInfo: () => ({
        isInBackupTier: false,
      }),
    };

    encryptAndUploadAttachment = sinon.stub().returns({
      cdnKey: 'newKeyOnTransitTier',
      cdnNumber: TRANSIT_CDN_FOR_NEW_UPLOAD,
    });
    const decryptAttachmentV2ToSink = sinon.stub();

    const { getAbsoluteAttachmentPath } = window.Signal.Migrations;
    const abortController = new AbortController();
    runJob = sandbox.stub().callsFake((job: AttachmentBackupJobType) => {
      return runAttachmentBackupJob(
        job,
        { abortSignal: abortController.signal, isLastAttempt: false },
        {
          // @ts-expect-error incomplete stubbing
          backupsService,
          backupMediaBatch,
          getAbsoluteAttachmentPath,
          encryptAndUploadAttachment,
          decryptAttachmentV2ToSink,
        }
      );
    });

    backupManager = new AttachmentBackupManager({
      ...AttachmentBackupManager.defaultParams,
      shouldHoldOffOnStartingQueuedJobs: isInCall,
      runJob,
    });
  });

  afterEach(async () => {
    sandbox.restore();
    await backupManager?.stop();
  });

  async function addJobs(
    num: number,
    overrides: Partial<StandardAttachmentBackupJobType['data']> = {}
  ): Promise<Array<StandardAttachmentBackupJobType>> {
    const jobs = new Array(num)
      .fill(null)
      .map((_, idx) => composeJob(idx, overrides));
    for (const job of jobs) {
      // eslint-disable-next-line no-await-in-loop
      await backupManager?.addJob(job);
    }
    return jobs;
  }

  async function addThumbnailJobs(
    num: number,
    overrides: Partial<ThumbnailAttachmentBackupJobType['data']> = {}
  ): Promise<Array<ThumbnailAttachmentBackupJobType>> {
    const jobs = new Array(num)
      .fill(null)
      .map((_, idx) => composeThumbnailJob(idx, overrides));
    for (const job of jobs) {
      // eslint-disable-next-line no-await-in-loop
      await backupManager?.addJob(job);
    }
    return jobs;
  }

  function waitForJobToBeStarted(
    job: CoreAttachmentBackupJobType,
    attempts: number = 0
  ) {
    return backupManager?.waitForJobToBeStarted({ ...job, attempts });
  }

  function waitForJobToBeCompleted(
    job: CoreAttachmentBackupJobType,
    attempts: number = 0
  ) {
    return backupManager?.waitForJobToBeCompleted({ ...job, attempts });
  }

  function assertRunJobCalledWith(jobs: Array<CoreAttachmentBackupJobType>) {
    return assert.strictEqual(
      JSON.stringify(runJob.getCalls().map(call => call.args[0].mediaName)),
      JSON.stringify(jobs.map(job => job.mediaName))
    );
  }

  async function getAllSavedJobs(): Promise<Array<AttachmentBackupJobType>> {
    return DataWriter.getNextAttachmentBackupJobs({
      limit: 1000,
      timestamp: Infinity,
    });
  }

  it('runs 3 jobs at a time in descending receivedAt order, fullsize first', async () => {
    const jobs = await addJobs(5);
    const thumbnailJobs = await addThumbnailJobs(5);

    // Confirm they are saved to DB
    const allJobs = await getAllSavedJobs();
    assert.strictEqual(allJobs.length, 10);

    await backupManager?.start();
    await waitForJobToBeStarted(jobs[2]);

    assert.strictEqual(runJob.callCount, 3);
    assertRunJobCalledWith([jobs[4], jobs[3], jobs[2]]);

    await waitForJobToBeStarted(jobs[0]);
    assert.strictEqual(runJob.callCount, 5);
    assertRunJobCalledWith([jobs[4], jobs[3], jobs[2], jobs[1], jobs[0]]);

    await waitForJobToBeCompleted(thumbnailJobs[0]);
    assert.strictEqual(runJob.callCount, 10);

    assertRunJobCalledWith([
      jobs[4],
      jobs[3],
      jobs[2],
      jobs[1],
      jobs[0],
      thumbnailJobs[4],
      thumbnailJobs[3],
      thumbnailJobs[2],
      thumbnailJobs[1],
      thumbnailJobs[0],
    ]);
    assert.strictEqual((await getAllSavedJobs()).length, 0);
  });

  it('with transitCdnInfo, will copy to backup tier', async () => {
    const [job] = await addJobs(1);
    await backupManager?.start();
    await waitForJobToBeCompleted(job);
    assert.strictEqual(backupMediaBatch.callCount, 1);
    assert.strictEqual(encryptAndUploadAttachment.callCount, 0);

    assert.deepStrictEqual(
      backupMediaBatch.getCall(0).args[0].items[0].sourceAttachment,
      { key: 'transitCdnKey', cdn: TRANSIT_CDN }
    );
  });

  it('with transitCdnInfo, will upload to attachment tier if copy operation returns FileNotFoundOnTransitTier', async () => {
    backupMediaBatch.onFirstCall().returns(
      Promise.resolve({
        responses: [
          { isSuccess: false, status: FILE_NOT_FOUND_ON_TRANSIT_TIER_STATUS },
        ],
      })
    );

    backupMediaBatch.onSecondCall().returns(
      Promise.resolve({
        responses: [{ isSuccess: true, cdn: BACKUP_CDN }],
      })
    );

    const [job] = await addJobs(1);
    await backupManager?.start();
    await waitForJobToBeCompleted(job);
    assert.strictEqual(encryptAndUploadAttachment.callCount, 1);
    assert.strictEqual(backupMediaBatch.callCount, 2);

    assert.deepStrictEqual(
      backupMediaBatch.getCall(0).args[0].items[0].sourceAttachment,
      { key: 'transitCdnKey', cdn: TRANSIT_CDN }
    );
    assert.deepStrictEqual(
      backupMediaBatch.getCall(1).args[0].items[0].sourceAttachment,
      { key: 'newKeyOnTransitTier', cdn: TRANSIT_CDN_FOR_NEW_UPLOAD }
    );

    const allRemainingJobs = await getAllSavedJobs();
    assert.strictEqual(allRemainingJobs.length, 0);
  });

  it('without transitCdnInfo, will upload then copy', async () => {
    const [job] = await addJobs(1, { transitCdnInfo: undefined });

    await backupManager?.start();
    await waitForJobToBeCompleted(job);

    assert.strictEqual(backupMediaBatch.callCount, 1);
    assert.strictEqual(encryptAndUploadAttachment.callCount, 1);

    // Job removed
    const allRemainingJobs = await getAllSavedJobs();
    assert.strictEqual(allRemainingJobs.length, 0);
  });

  it('without transitCdnInfo, will permanently remove job if file not found at path', async () => {
    const [job] = await addJobs(1, {
      transitCdnInfo: undefined,
      path: 'nothing/here',
    });

    await backupManager?.start();
    await waitForJobToBeCompleted(job);

    assert.strictEqual(backupMediaBatch.callCount, 0);
    assert.strictEqual(encryptAndUploadAttachment.callCount, 0);

    // Job removed
    const allRemainingJobs = await getAllSavedJobs();
    assert.strictEqual(allRemainingJobs.length, 0);
  });

  it('pauses if it receives a retryAfter', async () => {
    const jobs = await addJobs(5, { transitCdnInfo: undefined });

    encryptAndUploadAttachment.throws(
      new HTTPError('Rate limited', {
        code: 429,
        headers: { 'retry-after': '100' },
      })
    );
    await backupManager?.start();
    await waitForJobToBeStarted(jobs[2]);

    assert.strictEqual(runJob.callCount, 3);
    assertRunJobCalledWith([jobs[4], jobs[3], jobs[2]]);

    // no jobs have occurred
    await clock.tickAsync(50000);
    assert.strictEqual(runJob.callCount, 3);

    encryptAndUploadAttachment.returns({
      cdnKey: 'newKeyOnTransitTier',
      cdnNumber: TRANSIT_CDN_FOR_NEW_UPLOAD,
    });

    await clock.tickAsync(100000);
    await waitForJobToBeStarted(jobs[0]);
    assert.strictEqual(runJob.callCount, 8);
    assertRunJobCalledWith([
      jobs[4],
      jobs[3],
      jobs[2],
      jobs[4],
      jobs[3],
      jobs[2],
      jobs[1],
      jobs[0],
    ]);
  });

  describe('thumbnail backups', () => {
    it('addJobAndMaybeThumbnailJob conditionally adds thumbnail job', async () => {
      const jobForVisualAttachment = composeJob(0);
      const jobForNonVisualAttachment = composeJob(1, {
        contentType: APPLICATION_OCTET_STREAM,
      });

      await backupManager?.addJobAndMaybeThumbnailJob(jobForVisualAttachment);
      await backupManager?.addJobAndMaybeThumbnailJob(
        jobForNonVisualAttachment
      );

      const thumbnailMediaName = `${jobForVisualAttachment.mediaName}_thumbnail`;
      const allJobs = await getAllSavedJobs();
      assert.strictEqual(allJobs.length, 3);
      assert.sameMembers(
        allJobs.map(job => job.mediaName),
        ['mediaName1', 'mediaName0', thumbnailMediaName]
      );
    });
  });
});
