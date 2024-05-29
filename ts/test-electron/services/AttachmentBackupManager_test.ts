// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as sinon from 'sinon';
import { assert } from 'chai';
import { join } from 'path';

import * as Bytes from '../../Bytes';
import {
  AttachmentBackupManager,
  FILE_NOT_FOUND_ON_TRANSIT_TIER_STATUS,
  runAttachmentBackupJob,
} from '../../jobs/AttachmentBackupManager';
import type {
  AttachmentBackupJobType,
  CoreAttachmentBackupJobType,
} from '../../types/AttachmentBackup';
import dataInterface from '../../sql/Client';
import { getRandomBytes } from '../../Crypto';
import { VIDEO_MP4 } from '../../types/MIME';

const TRANSIT_CDN = 2;
const TRANSIT_CDN_FOR_NEW_UPLOAD = 42;
const BACKUP_CDN = 3;
describe('AttachmentBackupManager/JobManager', () => {
  let backupManager: AttachmentBackupManager | undefined;
  let runJob: sinon.SinonSpy;
  let backupMediaBatch: sinon.SinonStub;
  let backupsService = {};
  let encryptAndUploadAttachment: sinon.SinonStub;
  let getAbsoluteAttachmentPath: sinon.SinonStub;
  let sandbox: sinon.SinonSandbox;
  let isInCall: sinon.SinonStub;

  function composeJob(
    index: number,
    overrides: Partial<CoreAttachmentBackupJobType['data']> = {}
  ): CoreAttachmentBackupJobType {
    const mediaName = `mediaName${index}`;

    return {
      mediaName,
      type: 'standard',
      receivedAt: index,
      data: {
        path: 'ghost-kitty.mp4',
        contentType: VIDEO_MP4,
        keys: 'keys=',
        iv: 'iv==',
        digest: 'digest=',
        transitCdnInfo: {
          cdnKey: 'transitCdnKey',
          cdnNumber: TRANSIT_CDN,
          uploadTimestamp: Date.now(),
        },
        size: 128,
        ...overrides,
      },
    };
  }

  beforeEach(async () => {
    await dataInterface.removeAll();
    await window.storage.put('masterKey', Bytes.toBase64(getRandomBytes(32)));

    sandbox = sinon.createSandbox();
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

    getAbsoluteAttachmentPath = sandbox.stub().callsFake(path => {
      if (path === 'ghost-kitty.mp4') {
        return join(__dirname, '../../../fixtures/ghost-kitty.mp4');
      }
      return getAbsoluteAttachmentPath.wrappedMethod(path);
    });

    runJob = sandbox.stub().callsFake((job: AttachmentBackupJobType) => {
      return runAttachmentBackupJob(job, false, {
        // @ts-expect-error incomplete stubbing
        backupsService,
        backupMediaBatch,
        getAbsoluteAttachmentPath,
        encryptAndUploadAttachment,
      });
    });

    backupManager = new AttachmentBackupManager({
      ...AttachmentBackupManager.defaultParams,
      shouldHoldOffOnStartingQueuedJobs: isInCall,
      runJob,
    });
  });

  afterEach(async () => {
    sandbox.restore();
    delete window.textsecure.server;
    await backupManager?.stop();
  });

  async function addJobs(
    num: number,
    overrides: Partial<CoreAttachmentBackupJobType['data']> = {}
  ): Promise<Array<CoreAttachmentBackupJobType>> {
    const jobs = new Array(num)
      .fill(null)
      .map((_, idx) => composeJob(idx, overrides));
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
    return dataInterface.getNextAttachmentBackupJobs({
      limit: 1000,
      timestamp: Infinity,
    });
  }

  it('saves jobs, removes jobs, and runs 3 jobs at a time in descending receivedAt order', async () => {
    const jobs = await addJobs(5);

    // Confirm they are saved to DB
    const allJobs = await getAllSavedJobs();
    assert.strictEqual(allJobs.length, 5);
    assert.strictEqual(
      JSON.stringify(allJobs.map(job => job.mediaName)),
      JSON.stringify([
        'mediaName4',
        'mediaName3',
        'mediaName2',
        'mediaName1',
        'mediaName0',
      ])
    );

    await backupManager?.start();
    await waitForJobToBeStarted(jobs[2]);

    assert.strictEqual(runJob.callCount, 3);
    assertRunJobCalledWith([jobs[4], jobs[3], jobs[2]]);

    await waitForJobToBeStarted(jobs[0]);
    assert.strictEqual(runJob.callCount, 5);
    assertRunJobCalledWith([jobs[4], jobs[3], jobs[2], jobs[1], jobs[0]]);

    await waitForJobToBeCompleted(jobs[0]);
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
    const [job] = await addJobs(1, { transitCdnInfo: undefined });
    getAbsoluteAttachmentPath.returns('no/file/here');
    await backupManager?.start();
    await waitForJobToBeCompleted(job);

    assert.strictEqual(backupMediaBatch.callCount, 0);
    assert.strictEqual(encryptAndUploadAttachment.callCount, 0);

    // Job removed
    const allRemainingJobs = await getAllSavedJobs();
    assert.strictEqual(allRemainingJobs.length, 0);
  });
});
