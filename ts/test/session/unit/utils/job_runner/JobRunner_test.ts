import { expect } from 'chai';
import _, { isUndefined } from 'lodash';
import Sinon from 'sinon';
import { v4 } from 'uuid';
import {
  JobEventListener,
  PersistedJobRunner,
} from '../../../../../session/utils/job_runners/JobRunner';
import { FakeSleepForJob, FakeSleepForMultiJob } from './FakeSleepForJob';
import {
  FakeSleepForMultiJobData,
  FakeSleepJobData,
  TypeOfPersistedData,
} from '../../../../../session/utils/job_runners/PersistedJob';
import { sleepFor } from '../../../../../session/utils/Promise';
import { stubData } from '../../../../test-utils/utils';

function getFakeSleepForJob(timestamp: number): FakeSleepForJob {
  const job = new FakeSleepForJob({
    identifier: v4(),
    maxAttempts: 3,
    nextAttemptTimestamp: timestamp || 3000,
    currentRetry: 0,
  });
  return job;
}

function getFakeSleepForJobPersisted(timestamp: number): FakeSleepJobData {
  return getFakeSleepForJob(timestamp).serializeJob();
}

function getFakeSleepForMultiJob({
  timestamp,
  identifier,
  returnResult,
}: {
  timestamp: number;
  identifier?: string;
  returnResult?: boolean;
}): FakeSleepForMultiJob {
  const job = new FakeSleepForMultiJob({
    identifier: identifier || v4(),
    maxAttempts: 3,
    nextAttemptTimestamp: timestamp || 3000,
    currentRetry: 0,
    returnResult: isUndefined(returnResult) ? true : returnResult,
    sleepDuration: 5000,
  });
  return job;
}

// tslint:disable-next-line: max-func-body-length
describe('JobRunner', () => {
  let getItemById: Sinon.SinonStub;
  let clock: Sinon.SinonFakeTimers;
  let runner: PersistedJobRunner<FakeSleepJobData>;
  let runnerMulti: PersistedJobRunner<FakeSleepForMultiJobData>;
  let jobEventsListener: JobEventListener;

  beforeEach(() => {
    getItemById = stubData('getItemById');
    stubData('createOrUpdateItem');
    clock = Sinon.useFakeTimers({ shouldAdvanceTime: true });
    jobEventsListener = {
      onJobDeferred: (_job: TypeOfPersistedData) => {
        // window.log.warn('listener got deferred for job ', job);
      },
      onJobSuccess: (_job: TypeOfPersistedData) => {
        // window.log.warn('listener got success for job ', job);
      },
      onJobError: (_job: TypeOfPersistedData) => {
        // window.log.warn('listener got error for job ', job);
      },
      onJobStarted: (_job: TypeOfPersistedData) => {
        // window.log.warn('listener got started for job ', job);
      },
    };
    runner = new PersistedJobRunner<FakeSleepJobData>('FakeSleepForJob', jobEventsListener);
    runnerMulti = new PersistedJobRunner<FakeSleepForMultiJobData>(
      'FakeSleepForMultiJob',
      jobEventsListener
    );
  });

  afterEach(() => {
    Sinon.restore();
    runner.resetForTesting();
    runnerMulti.resetForTesting();
  });

  describe('loadJobsFromDb', () => {
    it('throw if not loaded', async () => {
      try {
        getItemById.resolves({
          id: '',
          value: JSON.stringify([]),
        });

        await runner.loadJobsFromDb();
        throw new Error('PLOP'); // the line above should throw something else
      } catch (e) {
        expect(e.message).to.not.eq('PLOP');
      }
    });
    it('unsorted list is sorted after loading', async () => {
      const unsorted = [
        getFakeSleepForJobPersisted(1),
        getFakeSleepForJobPersisted(5),
        getFakeSleepForJobPersisted(0),
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
    it('can add FakeSleepForJob ', async () => {
      await runner.loadJobsFromDb();
      const job = getFakeSleepForJob(123);
      const persisted = job.serializeJob();
      const result = await runner.addJob(job);
      expect(result).to.be.eq('job_deferred');

      expect(runner.getJobList()).to.deep.eq([persisted]);
    });
    it('does not add a second FakeSleepForJob if one is already there', async () => {
      await runner.loadJobsFromDb();
      const job = getFakeSleepForJob(123);
      const job2 = getFakeSleepForJob(1234);
      let result = await runner.addJob(job);
      expect(result).to.eq('job_deferred');
      result = await runner.addJob(job2);
      expect(result).to.eq('type_exists');
      const persisted = job.serializeJob();

      expect(runner.getJobList()).to.deep.eq([persisted]);
    });

    it('can add a FakeSleepForJobMulti (sorted) even if one is already there', async () => {
      await runnerMulti.loadJobsFromDb();
      const job = getFakeSleepForMultiJob({ timestamp: 1234 });
      const job2 = getFakeSleepForMultiJob({ timestamp: 123 });
      const job3 = getFakeSleepForMultiJob({ timestamp: 1 });

      let result = await runnerMulti.addJob(job);
      expect(result).to.eq('job_deferred');

      result = await runnerMulti.addJob(job2);
      expect(result).to.eq('job_deferred');

      result = await runnerMulti.addJob(job3);
      expect(result).to.eq('job_deferred');

      expect(runnerMulti.getJobList()).to.deep.eq([
        job3.serializeJob(),
        job2.serializeJob(),
        job.serializeJob(),
      ]);
    });

    it('cannot add a FakeSleepForJobMulti with an id already existing', async () => {
      await runnerMulti.loadJobsFromDb();
      const job = getFakeSleepForMultiJob({ timestamp: 1234 });
      const job2 = getFakeSleepForMultiJob({
        timestamp: 123,
        identifier: job.persistedData.identifier,
      });
      let result = await runnerMulti.addJob(job);
      expect(result).to.be.eq('job_deferred');
      result = await runnerMulti.addJob(job2);
      expect(result).to.be.eq('identifier_exists');

      expect(runnerMulti.getJobList()).to.deep.eq([job.serializeJob()]);
    });

    it('two jobs are running sequentially', async () => {
      await runnerMulti.loadJobsFromDb();
      const job = getFakeSleepForMultiJob({ timestamp: 100 });
      const job2 = getFakeSleepForMultiJob({ timestamp: 200 });
      runnerMulti.startProcessing();
      clock.tick(110);
      // job should be started right away
      let result = await runnerMulti.addJob(job);
      expect(result).to.eq('job_started');
      result = await runnerMulti.addJob(job2);
      expect(result).to.eq('job_deferred');
      expect(runnerMulti.getJobList()).to.deep.eq([job.serializeJob(), job2.serializeJob()]);
      expect(runnerMulti.getJobList()).to.deep.eq([job.serializeJob(), job2.serializeJob()]);

      // each job takes 5s to finish, so let's tick once the first one should be done
      clock.tick(5010);
      await runnerMulti.waitCurrentJob();
      clock.tick(5010);
      await runnerMulti.waitCurrentJob();

      expect(runnerMulti.getJobList()).to.deep.eq([job2.serializeJob()]);

      clock.tick(5000);
      await runnerMulti.waitCurrentJob();

      expect(runnerMulti.getJobList()).to.deep.eq([]);
    });

    it('adding one job after the first is done starts it', async () => {
      await runnerMulti.loadJobsFromDb();
      const job = getFakeSleepForMultiJob({ timestamp: 100 });
      const job2 = getFakeSleepForMultiJob({ timestamp: 120 });
      runnerMulti.startProcessing();
      clock.tick(110);
      // job should be started right away
      let result = await runnerMulti.addJob(job);
      expect(runnerMulti.getJobList()).to.deep.eq([job.serializeJob()]);

      expect(result).to.eq('job_started');
      clock.tick(5010);
      await runnerMulti.waitCurrentJob();
      clock.tick(5010);

      // just give some time for the runnerMulti to pick up a new job
      await sleepFor(100);

      // the first job should already be finished now
      result = await runnerMulti.addJob(job2);
      expect(result).to.eq('job_started');
      expect(runnerMulti.getJobList()).to.deep.eq([job2.serializeJob()]);

      // each job takes 5s to finish, so let's tick once the first one should be done
      clock.tick(5010);
      await runnerMulti.waitCurrentJob();

      expect(runnerMulti.getJobList()).to.deep.eq([]);
    });

    it('adding one job after the first is done schedules it', async () => {
      await runnerMulti.loadJobsFromDb();
      const job = getFakeSleepForMultiJob({ timestamp: 100 });
      runnerMulti.startProcessing();
      clock.tick(110);
      // job should be started right away
      let result = await runnerMulti.addJob(job);
      expect(runnerMulti.getJobList()).to.deep.eq([job.serializeJob()]);

      expect(result).to.eq('job_started');
      clock.tick(5010);
      await runnerMulti.waitCurrentJob();
      clock.tick(5010);
      // just give some time for the runner to pick up a new job

      await sleepFor(100);

      const job2 = getFakeSleepForMultiJob({ timestamp: clock.now + 100 });

      // job should already be finished now
      result = await runnerMulti.addJob(job2);
      // new job should be deferred as timestamp is not in the past
      expect(result).to.eq('job_deferred');
      expect(runnerMulti.getJobList()).to.deep.eq([job2.serializeJob()]);

      // tick enough for the job to need to be started
      clock.tick(100);

      // that job2 should be running now
      await sleepFor(100);
      clock.tick(5000);

      await job2.waitForCurrentTry();
      await runnerMulti.waitCurrentJob();

      expect(runnerMulti.getJobList()).to.deep.eq([]);
    });
  });

  describe('startProcessing FakeSleepForJob', () => {
    it('does not trigger anything if no job present ', async () => {
      await runner.loadJobsFromDb();
      expect(runner.startProcessing()).to.be.eq('no_job');
    });

    it('triggers a job right away if there is a job which should already be running', async () => {
      await runner.loadJobsFromDb();
      clock.tick(100);
      const job = getFakeSleepForJob(50);
      await runner.addJob(job);
      expect(runner.startProcessing()).to.be.eq('job_started');
    });

    it('plans a deferred job if there is a job starting later', async () => {
      await runner.loadJobsFromDb();
      clock.tick(100);
      const job = getFakeSleepForJob(150);
      await runner.addJob(job);
      expect(runner.startProcessing()).to.be.eq('job_deferred');
    });
  });

  describe('stopAndWaitCurrentJob', () => {
    it('does not await if no job at all ', async () => {
      await runner.loadJobsFromDb();
      runner.startProcessing();
      expect(runner.stopAndWaitCurrentJob()).to.be.eventually.eq('no_await');
    });

    it('does not await if there are jobs but none are started', async () => {
      await runner.loadJobsFromDb();
      clock.tick(100);
      const job = getFakeSleepForJob(150);
      await runner.addJob(job);
      expect(runner.startProcessing()).to.be.eq('job_deferred');
      expect(runner.stopAndWaitCurrentJob()).to.be.eventually.eq('no_await');
    });

    it('does await if there are jobs and one is started', async () => {
      await runner.loadJobsFromDb();
      clock.tick(200);
      const job = getFakeSleepForJob(150);
      await runner.addJob(job);
      expect(runner.startProcessing()).to.be.eq('job_started');
      clock.tick(5000);

      expect(runner.stopAndWaitCurrentJob()).to.be.eventually.eq('await');
    });
  });

  describe('retriesFailing Jobns', () => {
    it('does not await if no job at all ', async () => {
      await runner.loadJobsFromDb();
      runner.startProcessing();
      expect(runner.stopAndWaitCurrentJob()).to.be.eventually.eq('no_await');
    });

    it('does not await if there are jobs but none are started', async () => {
      await runner.loadJobsFromDb();
      clock.tick(100);
      const job = getFakeSleepForJob(150);
      await runner.addJob(job);
      expect(runner.startProcessing()).to.be.eq('job_deferred');
      expect(runner.stopAndWaitCurrentJob()).to.be.eventually.eq('no_await');
    });

    it('does await if there are jobs and one is started', async () => {
      await runnerMulti.loadJobsFromDb();
      const job = getFakeSleepForMultiJob({ timestamp: 100, returnResult: false }); // this job keeps failing
      runnerMulti.startProcessing();
      clock.tick(110);
      // job should be started right away
      const result = await runnerMulti.addJob(job);
      expect(runnerMulti.getJobList()).to.deep.eq([job.serializeJob()]);

      expect(result).to.eq('job_started');
      clock.tick(5010);
      await runnerMulti.waitCurrentJob();
      const jobUpdated = {
        ...job.serializeJob(),
        nextAttemptTimestamp: clock.now + 10000,
        currentRetry: 1,
      };
      // just give  time for the runnerMulti to pick up a new job
      await sleepFor(10);

      // the job failed, so the job should still be there
      expect(runnerMulti.getJobList()).to.deep.eq([jobUpdated]);

      // that job should be retried now
      clock.tick(11000);
      await runner.waitCurrentJob();
      const jobUpdated2 = {
        ...job.serializeJob(),
        nextAttemptTimestamp: clock.now + 10000,
        currentRetry: 2,
      };
      await sleepFor(10);

      await runnerMulti.waitCurrentJob();
      expect(runnerMulti.getJobList()).to.deep.eq([jobUpdated2]);

      // that job should be retried one more time and then removed from the list of jobs to be run
      clock.tick(11000);
      await runnerMulti.waitCurrentJob();
      await sleepFor(10);

      await runnerMulti.waitCurrentJob();
      expect(runnerMulti.getJobList()).to.deep.eq([]);
    });
  });
});
