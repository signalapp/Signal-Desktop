// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type JobQueueStore = {
  /**
   * Add a job to the database. Doing this should enqueue it in the stream.
   */
  insert(
    job: Readonly<StoredJob>,
    options?: Readonly<{ shouldPersist?: boolean }>
  ): Promise<void>;

  /**
   * Remove a job. This should be called when a job finishes successfully or
   * if a job has totally failed.
   *
   * It should NOT be called to cancel a job.
   */
  delete(id: string): Promise<void>;

  /**
   * Stream jobs for a given queue. At startup, this stream may produce a bunch of
   * jobs. After that, it should produce one job per `insert`.
   */
  stream(queueType: string): AsyncIterable<StoredJob>;
};

export type ParsedJob<T> = {
  readonly id: string;
  readonly timestamp: number;
  readonly queueType: string;
  readonly data: T;
};

export type StoredJob = {
  readonly id: string;
  readonly timestamp: number;
  readonly queueType: string;
  readonly data?: unknown;
};

export enum JobCancelReason {
  UserInitiated = 'UserInitiated',
  Shutdown = 'Shutdown',
  JobManagerStopped = 'JobManagerStopped',
  PowerMonitorSuspend = 'PowerMonitorSuspend',
  PowerMonitorResume = 'PowerMonitorResume',
}
