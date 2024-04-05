import { cloneDeep, compact, isArray, isString } from 'lodash';
import { Data } from '../../../data/data';
import { Storage } from '../../../util/storage';
import { timeout } from '../Promise';
import { persistedJobFromData } from './JobDeserialization';
import {
  AvatarDownloadPersistedData,
  ConfigurationSyncPersistedData,
  FetchMsgExpirySwarmPersistedData,
  PersistedJob,
  RunJobResult,
  TypeOfPersistedData,
  UpdateMsgExpirySwarmPersistedData,
} from './PersistedJob';
import { JobRunnerType } from './jobs/JobRunnerType';

/**
 * 'job_in_progress' if there is already a job in progress
 * 'job_deferred' if there is a next job, but too far in the future to start it now
 * 'job_started' a job was pending to be started and we could start it, so we started it
 * 'no_job' if there are no jobs to be run at all
 */
export type StartProcessingResult = 'job_in_progress' | 'job_deferred' | 'job_started' | 'no_job';

export type AddJobResult = 'job_deferred' | 'job_started';

function jobToLogId<T extends TypeOfPersistedData>(jobRunner: JobRunnerType, job: PersistedJob<T>) {
  return `id: "${job.persistedData.identifier}" (type: "${jobRunner}")`;
}

/**
 * This class is used to plan jobs and make sure they are retried until the success.
 * By having a specific type, we can find the logic to be run by that type of job.
 *
 * There are different type of jobs which can be scheduled, but we currently only use the SyncConfigurationJob.
 *
 * SyncConfigurationJob is a job which can only be planned once until it is a success. So in the queue  on jobs, there can only be one SyncConfigurationJob at all times.
 *
 */
export class PersistedJobRunner<T extends TypeOfPersistedData> {
  private isInit = false;
  private jobsScheduled: Array<PersistedJob<T>> = [];
  private isStarted = false;
  private readonly jobRunnerType: JobRunnerType;
  private nextJobStartTimer: NodeJS.Timeout | null = null;
  private currentJob: PersistedJob<T> | null = null;

  constructor(jobRunnerType: JobRunnerType, _jobEventsListener: null) {
    this.jobRunnerType = jobRunnerType;
    window?.log?.warn(`new runner of type ${jobRunnerType} built`);
  }

  public async loadJobsFromDb() {
    if (this.isInit) {
      return;
    }
    let jobsArray: Array<T> = [];
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
    const jobs: Array<PersistedJob<T>> = compact(jobsArray.map(persistedJobFromData));
    this.jobsScheduled = cloneDeep(jobs);
    // make sure the list is sorted
    this.sortJobsList();
    this.isInit = true;
  }

  public async addJob(
    job: PersistedJob<T>
  ): Promise<'type_exists' | 'identifier_exists' | AddJobResult> {
    this.assertIsInitialized();

    if (this.jobsScheduled.find(j => j.persistedData.identifier === job.persistedData.identifier)) {
      window.log.info(
        `job runner (${this.jobRunnerType}) has already a job with id:"${job.persistedData.identifier}" planned so not adding another one`
      );
      return 'identifier_exists';
    }

    const serializedNonRunningJobs = this.jobsScheduled
      .filter(j => j !== this.currentJob)
      .map(k => k.serializeJob());

    const addJobChecks = job.addJobCheck(serializedNonRunningJobs);
    if (addJobChecks === 'skipAddSameJobPresent') {
      // window.log.warn(`addjobCheck returned "${addJobChecks}" so not adding it`);
      return 'type_exists';
    }

    // make sure there is no job with that same identifier already .

    window.log.debug(`job runner adding type:"${job.persistedData.jobType}"`);
    return this.addJobUnchecked(job);
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

  public getCurrentJobIdentifier(): string | null {
    return this.currentJob?.persistedData?.identifier || null;
  }

  /**
   * if we are running a job, this call will await until the job is done and stop the queue
   */
  public async stopAndWaitCurrentJob(): Promise<'no_await' | 'await'> {
    if (!this.isStarted || !this.currentJob) {
      return 'no_await';
    }
    this.isStarted = false;
    await this.currentJob.waitForCurrentTry();
    return 'await';
  }

  /**
   * if we are running a job, this call will await until the job is done.
   * If another job must be run right away this one, we will also add the upcoming one as the currentJob.
   */
  public async waitCurrentJob(): Promise<'no_await' | 'await'> {
    if (!this.isStarted || !this.currentJob) {
      return 'no_await';
    }
    await this.currentJob.waitForCurrentTry();
    return 'await';
  }

  public startProcessing(): StartProcessingResult {
    if (this.isStarted) {
      return this.planNextJob();
    }
    this.isStarted = true;
    return this.planNextJob();
  }

  private sortJobsList() {
    this.jobsScheduled.sort(
      (a, b) => a.persistedData.nextAttemptTimestamp - b.persistedData.nextAttemptTimestamp
    );
  }

  private async writeJobsToDB() {
    const serialized = this.getSerializedJobs();

    await Storage.put(this.getJobRunnerItemId(), JSON.stringify(serialized));
  }

  private async addJobUnchecked(job: PersistedJob<T>) {
    this.jobsScheduled.push(cloneDeep(job));
    this.sortJobsList();
    await this.writeJobsToDB();
    // a new job was added. trigger it if we can/have to start it
    const result = this.planNextJob();

    if (result === 'no_job') {
      throw new Error('We just pushed a job, there cannot be no job');
    }
    if (result === 'job_in_progress') {
      return 'job_deferred';
    }
    return result;
  }

  private getSerializedJobs() {
    return this.jobsScheduled.map(m => m.serializeJob());
  }

  private getJobRunnerItemId() {
    return `jobRunner-${this.jobRunnerType}`;
  }

  /**
   * Returns 'job_in_progress' if there is already a job running
   * Returns 'none' if there are no jobs to be started at all (or the runner is not running)
   * Returns 'started' if there the next jobs was just started
   * Returns 'job_deferred' if there is a next job but it is in the future and so wasn't started yet, but a timer is set.
   */
  private planNextJob(): StartProcessingResult {
    if (!this.isStarted) {
      if (this.jobsScheduled.length) {
        return 'job_deferred';
      }
      return 'no_job';
    }

    if (this.currentJob) {
      return 'job_in_progress';
    }
    const nextJob = this.jobsScheduled?.[0];

    if (!nextJob) {
      return 'no_job';
    }

    if (nextJob.persistedData.nextAttemptTimestamp <= Date.now()) {
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
      // remove the timer as there might be a more urgent job to be run before the one we have set here.
      global.clearTimeout(this.nextJobStartTimer);
    }
    // plan a timer to wakeup when that timer is reached.
    this.nextJobStartTimer = global.setTimeout(
      () => {
        if (this.nextJobStartTimer) {
          global.clearTimeout(this.nextJobStartTimer);
          this.nextJobStartTimer = null;
        }
        void this.runNextJob();
      },
      Math.max(nextJob.persistedData.nextAttemptTimestamp - Date.now(), 1)
    );

    return 'job_deferred';
  }

  private deleteJobsByIdentifier(identifiers: Array<string>) {
    identifiers.forEach(identifier => {
      const jobIndex = this.jobsScheduled.findIndex(f => f.persistedData.identifier === identifier);
      window.log.debug(
        `removing job ${jobToLogId(
          this.jobRunnerType,
          this.jobsScheduled[jobIndex]
        )} at ${jobIndex}`
      );

      if (jobIndex >= 0) {
        this.jobsScheduled.splice(jobIndex, 1);
      }
    });
  }

  private async runNextJob() {
    this.assertIsInitialized();
    if (this.currentJob || !this.isStarted || !this.jobsScheduled.length) {
      return;
    }

    const nextJob = this.jobsScheduled[0];

    // if the time is 101, and that task is to be run at t=101, we need to start it right away.
    if (nextJob.persistedData.nextAttemptTimestamp > Date.now()) {
      window.log.warn(
        'next job is not due to be run just yet. Going idle.',
        nextJob.persistedData.nextAttemptTimestamp - Date.now()
      );
      this.planNextJob();
      return;
    }
    let success: RunJobResult | null = null;

    try {
      if (this.currentJob) {
        return;
      }
      this.currentJob = nextJob;

      success = await timeout(this.currentJob.runJob(), this.currentJob.getJobTimeoutMs());

      if (success !== RunJobResult.Success) {
        throw new Error('return result was not "Success"');
      }

      // here the job did not throw and didn't return false. Consider it OK then and remove it from the list of jobs to run.
      this.deleteJobsByIdentifier([this.currentJob.persistedData.identifier]);
      await this.writeJobsToDB();
    } catch (e) {
      window.log.info(`${jobToLogId(this.jobRunnerType, nextJob)} failed with "${e.message}"`);
      if (
        success === RunJobResult.PermanentFailure ||
        nextJob.persistedData.currentRetry >= nextJob.persistedData.maxAttempts - 1
      ) {
        if (success === RunJobResult.PermanentFailure) {
          window.log.info(
            `${jobToLogId(this.jobRunnerType, nextJob)}:${
              nextJob.persistedData.currentRetry
            } permament failure for job`
          );
        } else {
          window.log.info(
            `Too many failures for ${jobToLogId(this.jobRunnerType, nextJob)}: ${
              nextJob.persistedData.currentRetry
            } out of ${nextJob.persistedData.maxAttempts}`
          );
        }
        // we cannot restart this job anymore. Remove the entry completely
        this.deleteJobsByIdentifier([nextJob.persistedData.identifier]);
      } else {
        window.log.info(
          `Rescheduling ${jobToLogId(this.jobRunnerType, nextJob)} in ${
            nextJob.persistedData.delayBetweenRetries
          }...`
        );
        nextJob.persistedData.currentRetry += 1;
        // that job can be restarted. Plan a retry later with the already defined retry
        nextJob.persistedData.nextAttemptTimestamp =
          Date.now() + nextJob.persistedData.delayBetweenRetries;
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
        'persisted job runner was not initlized yet. Call loadJobsFromDb with what you have persisted first'
      );
    }
  }
}

const configurationSyncRunner = new PersistedJobRunner<ConfigurationSyncPersistedData>(
  'ConfigurationSyncJob',
  null
);

const avatarDownloadRunner = new PersistedJobRunner<AvatarDownloadPersistedData>(
  'AvatarDownloadJob',
  null
);

const updateMsgExpiryRunner = new PersistedJobRunner<UpdateMsgExpirySwarmPersistedData>(
  'UpdateMsgExpirySwarmJob',
  null
);

const fetchSwarmMsgExpiryRunner = new PersistedJobRunner<FetchMsgExpirySwarmPersistedData>(
  'FetchMsgExpirySwarmJob',
  null
);

export const runners = {
  configurationSyncRunner,
  updateMsgExpiryRunner,
  fetchSwarmMsgExpiryRunner,
  avatarDownloadRunner,
};
