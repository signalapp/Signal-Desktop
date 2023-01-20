import { expect } from 'chai';
import _ from 'lodash';
import Sinon from 'sinon';
import { v4 } from 'uuid';
import { persistedJobFromData } from '../../../../../session/utils/job_runners/JobDeserialization';
import { PersistedJobRunner } from '../../../../../session/utils/job_runners/JobRunner';
import { SerializedPersistedJob } from '../../../../../session/utils/job_runners/PersistedJob';
import { stubData } from '../../../../test-utils/utils';

function getFakeConfigurationJobPersisted(timestamp: number): SerializedPersistedJob {
  return {
    jobType: 'ConfigurationSyncJobType',
    identifier: v4(),
    delayBetweenRetries: 3000,
    maxAttempts: 3,
    nextAttemptTimestamp: timestamp || Date.now() + 3000,
    singleJobInQueue: true,
    currentRetry: 0,
  };
}

function getFakeConfigurationJob(timestamp: number) {
  const job = persistedJobFromData(getFakeConfigurationJobPersisted(timestamp));
  if (!job) {
    throw new Error('persistedJobFromData failed');
  }
  return job;
}

describe('JobRunner', () => {
  let getItemById: Sinon.SinonStub;
  let createOrUpdateItem: Sinon.SinonStub;
  let clock: Sinon.SinonFakeTimers;

  let runner: PersistedJobRunner;

  beforeEach(() => {
    getItemById = stubData('getItemById');
    createOrUpdateItem = stubData('createOrUpdateItem');
    clock = Sinon.useFakeTimers();
    runner = new PersistedJobRunner('ConfigurationSyncJob');
  });

  afterEach(() => {
    Sinon.restore();
    runner.resetForTesting();
  });

  describe('loadJobsFromDb', () => {
    it('throw if already loaded', async () => {
      await runner.loadJobsFromDb();
      try {
        await runner.loadJobsFromDb();
        throw new Error('PLOP'); // the line above should throw something else
      } catch (e) {
        expect(e.message).to.not.eq('PLOP');
      }
    });
    it('unsorted list is sorted after loading', async () => {
      const unsorted = [
        getFakeConfigurationJobPersisted(1),
        getFakeConfigurationJobPersisted(5),
        getFakeConfigurationJobPersisted(0),
      ];
      getItemById.resolves({
        id: '',
        value: JSON.stringify(unsorted),
      });

      await runner.loadJobsFromDb();

      const jobList = runner.getJobList();
      expect(jobList).to.be.deep.eq(
        unsorted.sort((a, b) => a.nextAttemptTimestamp - b.nextAttemptTimestamp)
      );
    });

    it('invalid stored data results in empty array of jobs', async () => {
      const unsorted = { invalid: 'data' };
      getItemById.resolves({
        id: '',
        value: JSON.stringify(unsorted),
      });

      await runner.loadJobsFromDb();

      const jobList = runner.getJobList();
      expect(jobList).to.be.deep.eq([]);
    });

    it('no stored data results in empty array of jobs', async () => {
      getItemById.resolves(null);

      await runner.loadJobsFromDb();

      const jobList = runner.getJobList();
      expect(jobList).to.be.deep.eq([]);
    });
  });

  describe('addJob', () => {
    it('can add configurationSyncJob ', async () => {
      await runner.loadJobsFromDb();
      const job = getFakeConfigurationJob(123);
      const persisted = job.serializeJob();
      await runner.addJob(job);

      expect(runner.getJobList()).to.deep.eq([persisted]);
    });
    it('does not add a second configurationSyncJob if one is already there', async () => {
      await runner.loadJobsFromDb();
      const job = getFakeConfigurationJob(123);
      const job2 = getFakeConfigurationJob(1234);
      await runner.addJob(job);
      await runner.addJob(job2);
      const persisted = job.serializeJob();

      expect(runner.getJobList()).to.deep.eq([persisted]);
    });
  });

  describe('startProcessing Config Sync Jobs', () => {
    it('does not trigger anything if no job present ', async () => {
      await runner.loadJobsFromDb();
      expect(runner.startProcessing()).to.be.eq('no_job');
    });

    it('triggers a job right away if there is a job which should already be running', async () => {
      await runner.loadJobsFromDb();
      clock.tick(100);
      const job = getFakeConfigurationJob(50);
      await runner.addJob(job);
      expect(runner.startProcessing()).to.be.eq('job_started');
    });

    it('plans a deffered job if there is a job starting later', async () => {
      await runner.loadJobsFromDb();
      clock.tick(100);
      const job = getFakeConfigurationJob(150);
      await runner.addJob(job);
      expect(runner.startProcessing()).to.be.eq('job_deferred');
    });
  });
});
