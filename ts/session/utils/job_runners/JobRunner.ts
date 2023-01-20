import { cloneDeep, compact, isArray, isString } from 'lodash';
import { Data } from '../../../data/data';
import { persistedJobFromData } from './JobDeserialization';
import { JobRunnerType } from './jobs/JobRunnerType';
import { Persistedjob, SerializedPersistedJob } from './PersistedJob';

/**
 * 'not_running' when the queue is not running
 * 'already_started' if startProcessing was called already once before
 * 'job_in_progress' if there is already a job in progress
 * 'job_deferred' if there is a next job, but too far in the future to start it now
 * 'job_started' a job was pending to be started and we could start it, so we started it
 * 'no_job' if there are no jobs to be run at all
 */
export type StartProcessingResult =
  | 'not_running'
  | 'already_started'
  | 'job_in_progress'
  | 'job_deferred'
  | 'job_started'
  | 'no_job';

export class PersistedJobRunner {
  private isInit = false;
  private jobsScheduled: Array<Persistedjob> = [];
  private isStarted = false;
  private readonly jobRunnerType: JobRunnerType;
  private nextJobStartTimer: NodeJS.Timeout | null = null;
  private currentJob: Persistedjob | null = null;

  constructor(jobRunnerType: JobRunnerType) {
    this.jobRunnerType = jobRunnerType;
    console.warn('new runner');
  }

  public async loadJobsFromDb() {
    if (this.isInit) {
      throw new Error('job runner already init');
    }
    let jobsArray: Array<SerializedPersistedJob> = [];
    const found = await Data.getItemById(this.getJobRunnerItemId());
    if (found && found.value && isString(found.value)) {
      const asStr = found.value;

      try {
        const parsed = JSON.parse(asStr);
        if (!isArray(parsed)) {
          jobsArray = [];
        } else {
          jobsArray = parsed;
        }
      } catch (e) {
        window.log.warn(`Failed to parse jobs of type ${this.jobRunnerType} from DB`);
        jobsArray = [];
      }
    }
    const jobs: Array<Persistedjob> = compact(jobsArray.map(persistedJobFromData));
    this.jobsScheduled = cloneDeep(jobs);
    // make sure the list is sorted
    this.sortJobsList();
    this.isInit = true;
  }

  public async addJob(job: Persistedjob) {
    this.assertIsInitialized();

    if (job.singleJobInQueue) {
      // make sure there is no job with that same type already scheduled.
      if (this.jobsScheduled.find(j => j.jobType === job.jobType)) {
        console.info(
          `job runner has already a job "${job.identifier}" planned so not adding another one`
        );
        return;
      }

      this.jobsScheduled.push(job);
      this.sortJobsList();
      await this.writeJobsToDB();

      if (this.isStarted) {
        // a new job was added. trigger it if we can/have to start it
        this.planNextJob();
      }

      return;
    }
    throw new Error('persisted job runner does not support non single type for now.');
  }

  /**
   * Only used for testing
   */
  public getJobList() {
    return this.getSerializedJobs();
  }

  public resetForTesting() {
    this.jobsScheduled = [];
    this.isInit = false;

    if (this.nextJobStartTimer) {
      clearTimeout(this.nextJobStartTimer);
      this.nextJobStartTimer = null;
    }
    this.currentJob = null;
  }

  /**
   * if we are running a job, this call will await until the job is done
   */
  public async stopAndWaitCurrentJob() {
    if (!this.isStarted || !this.currentJob) {
      return;
    }
    this.isStarted = false;
    if (this.currentJob) {
      await this.currentJob.waitForCurrentTry();
    }
  }

  public startProcessing(): StartProcessingResult {
    if (this.isStarted) {
      return 'already_started';
    }
    this.isStarted = true;
    return this.planNextJob();
  }

  private sortJobsList() {
    this.jobsScheduled.sort((a, b) => a.nextAttemptTimestamp - b.nextAttemptTimestamp);
  }

  private async writeJobsToDB() {
    const serialized = this.getSerializedJobs();
    console.warn('writing to db', serialized);
    await Data.createOrUpdateItem({
      id: this.getJobRunnerItemId(),
      value: JSON.stringify(serialized),
    });
  }

  private getSerializedJobs() {
    return this.jobsScheduled.map(m => m.serializeJob());
  }

  private getJobRunnerItemId() {
    return `jobRunner-${this.jobRunnerType}`;
  }

  /**
   * Returns 'not_running' if that job runner is not started at all
   * Returns 'in_progress' if there is already a job running
   * Returns 'none' if there are no jobs to be started at all (or the runner is not running)
   * Returns 'started' if there the next jobs was just started
   * Returns 'deferred' if there is a next job but it is in the future and so wasn't started yet, but a timer is set.
   */
  private planNextJob(): StartProcessingResult {
    if (!this.isStarted) {
      return 'not_running';
    }
    if (this.currentJob) {
      return 'job_in_progress';
    }
    if (!this.jobsScheduled.length) {
      return 'no_job';
    }

    const nextJob = this.jobsScheduled[0];

    if (!nextJob) {
      return 'no_job';
    }

    if (nextJob.nextAttemptTimestamp <= Date.now()) {
      if (this.nextJobStartTimer) {
        global.clearTimeout(this.nextJobStartTimer);
        this.nextJobStartTimer = null;
      }
      // nextJob should be started right away
      void this.runNextJob();
      return 'job_started';
    }

    // next job is not to be started right away, just plan our runner to be awakened when the time is right.
    if (this.nextJobStartTimer) {
      global.clearTimeout(this.nextJobStartTimer);
    }
    // plan a timer to wakeup when that timer is reached.
    this.nextJobStartTimer = global.setTimeout(() => {
      console.warn('wakeup timer');
      if (this.nextJobStartTimer) {
        global.clearTimeout(this.nextJobStartTimer);
        this.nextJobStartTimer = null;
      }
      void this.runNextJob();
    }, Math.max(nextJob.nextAttemptTimestamp - Date.now(), 1));

    return 'job_deferred';
  }

  private deleteJobByIdentifier(identifier: string) {
    const jobIndex = this.jobsScheduled.findIndex(f => f.identifier === identifier);
    if (jobIndex >= 0) {
      this.jobsScheduled.splice(jobIndex, 1);
    }
  }

  private async runNextJob() {
    console.warn('runNextJob called');
    this.assertIsInitialized();
    if (this.currentJob || !this.isStarted || !this.jobsScheduled.length) {
      return;
    }

    const nextJob = this.jobsScheduled[0];

    if (nextJob.nextAttemptTimestamp >= Date.now()) {
      window.log.info('next job is not to be run just yet. Going idle.');
      this.planNextJob();
      return;
    }

    try {
      if (this.currentJob) {
        return;
      }
      this.currentJob = nextJob;
      const success = await this.currentJob.runJob();
      if (!success) {
        throw new Error(`job ${nextJob.identifier} failed`);
      }
      // here the job did not throw and didn't return false. Consider it OK then and remove it from the list of jobs to run.
      this.deleteJobByIdentifier(this.currentJob.identifier);
      await this.writeJobsToDB();
    } catch (e) {
      // either the job throw or didn't return 'OK'
      if (nextJob.currentRetry >= nextJob.maxAttempts) {
        // we cannot restart this job anymore. Remove the entry completely
        this.deleteJobByIdentifier(nextJob.identifier);
      } else {
        // that job can be restarted. Plan a retry later with the already defined retry
        nextJob.nextAttemptTimestamp = Date.now() + nextJob.delayBetweenRetries;
      }
      // in any case, either we removed a job or changed one of the timestamp.
      // so sort the list again, and persist it
      this.sortJobsList();
      await this.writeJobsToDB();
    } finally {
      this.currentJob = null;
      // start the next job if there is any to be started now, or just plan the wakeup of our runner for the right time.
      this.planNextJob();
    }
  }

  private assertIsInitialized() {
    if (!this.isInit) {
      throw new Error(
        'persisted job runner was not initlized yet. Call initWithData with what you have persisted first'
      );
    }
  }
}

const configurationSyncRunner = new PersistedJobRunner('ConfigurationSyncJob');

export const runners = {
  configurationSyncRunner,
};
