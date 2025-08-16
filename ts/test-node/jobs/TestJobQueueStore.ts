// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */
/* eslint-disable no-await-in-loop */

import EventEmitter, { once } from 'events';

import type { JobQueueStore, StoredJob } from '../../jobs/types';
import { sleep } from '../../util/sleep';
import { drop } from '../../util/drop';

export class TestJobQueueStore implements JobQueueStore {
  events = new EventEmitter();

  #openStreams = new Set<string>();
  #pipes = new Map<string, Pipe>();

  storedJobs: Array<StoredJob> = [];

  constructor(jobs: ReadonlyArray<StoredJob> = []) {
    jobs.forEach(job => {
      drop(this.insert(job));
    });
  }

  async insert(
    job: Readonly<StoredJob>,
    { shouldPersist = true }: Readonly<{ shouldPersist?: boolean }> = {}
  ): Promise<void> {
    await fakeDelay();

    this.storedJobs.forEach(storedJob => {
      if (job.id === storedJob.id) {
        throw new Error('Cannot store two jobs with the same ID');
      }
    });

    if (shouldPersist) {
      this.storedJobs.push(job);
    }

    this.#getPipe(job.queueType).add(job);

    this.events.emit('insert');
  }

  async delete(id: string): Promise<void> {
    await fakeDelay();

    this.storedJobs = this.storedJobs.filter(job => job.id !== id);

    this.events.emit('delete');
  }

  stream(queueType: string): Pipe {
    if (this.#openStreams.has(queueType)) {
      throw new Error('Cannot stream the same queueType more than once');
    }
    this.#openStreams.add(queueType);

    return this.#getPipe(queueType);
  }

  pauseStream(queueType: string): void {
    return this.#getPipe(queueType).pause();
  }

  resumeStream(queueType: string): void {
    return this.#getPipe(queueType).resume();
  }

  #getPipe(queueType: string): Pipe {
    const existingPipe = this.#pipes.get(queueType);
    if (existingPipe) {
      return existingPipe;
    }

    const result = new Pipe();
    this.#pipes.set(queueType, result);
    return result;
  }
}

class Pipe implements AsyncIterable<StoredJob> {
  #queue: Array<StoredJob> = [];
  #eventEmitter = new EventEmitter();
  #isLocked = false;
  #isPaused = false;

  add(value: Readonly<StoredJob>) {
    this.#queue.push(value);
    this.#eventEmitter.emit('add');
  }

  async *[Symbol.asyncIterator]() {
    if (this.#isLocked) {
      throw new Error('Cannot iterate over a pipe more than once');
    }
    this.#isLocked = true;

    while (true) {
      for (const value of this.#queue) {
        await this.#waitForUnpaused();
        yield value;
      }
      this.#queue = [];

      // We do this because we want to yield values in series.
      await once(this.#eventEmitter, 'add');
    }
  }

  pause(): void {
    this.#isPaused = true;
  }

  resume(): void {
    this.#isPaused = false;
    this.#eventEmitter.emit('resume');
  }

  async #waitForUnpaused() {
    if (this.#isPaused) {
      await once(this.#eventEmitter, 'resume');
    }
  }
}

function fakeDelay(): Promise<void> {
  return sleep(0);
}
