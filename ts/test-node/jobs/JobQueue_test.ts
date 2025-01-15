// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import { assert } from 'chai';
import * as sinon from 'sinon';
import EventEmitter, { once } from 'events';
import { z } from 'zod';
import { noop, groupBy } from 'lodash';
import { v4 as uuid } from 'uuid';
import PQueue from 'p-queue';
import { JobError } from '../../jobs/JobError';
import { TestJobQueueStore } from './TestJobQueueStore';
import { missingCaseError } from '../../util/missingCaseError';
import { drop } from '../../util/drop';
import type { LoggerType } from '../../types/Logging';

import type { JOB_STATUS } from '../../jobs/JobQueue';
import { JobQueue } from '../../jobs/JobQueue';
import type { ParsedJob, StoredJob, JobQueueStore } from '../../jobs/types';
import { sleep } from '../../util/sleep';
import { parseUnknown } from '../../util/schemas';

describe('JobQueue', () => {
  describe('end-to-end tests', () => {
    it('writes jobs to the database, processes them, and then deletes them', async () => {
      const testJobSchema = z.object({
        a: z.number(),
        b: z.number(),
      });

      type TestJobData = z.infer<typeof testJobSchema>;

      const results = new Set<unknown>();
      const store = new TestJobQueueStore();

      class Queue extends JobQueue<TestJobData> {
        parseData(data: unknown): TestJobData {
          return parseUnknown(testJobSchema, data);
        }

        async run({
          data,
        }: ParsedJob<TestJobData>): Promise<
          typeof JOB_STATUS.NEEDS_RETRY | undefined
        > {
          results.add(data.a + data.b);
          return undefined;
        }
      }

      const addQueue = new Queue({
        store,
        queueType: 'test add queue',
        maxAttempts: 1,
      });

      assert.deepEqual(results, new Set());
      assert.isEmpty(store.storedJobs);

      drop(addQueue.streamJobs());

      store.pauseStream('test add queue');
      const job1 = await addQueue.add({ a: 1, b: 2 });
      const job2 = await addQueue.add({ a: 3, b: 4 });

      assert.deepEqual(results, new Set());
      assert.lengthOf(store.storedJobs, 2);

      store.resumeStream('test add queue');

      await job1.completion;
      await job2.completion;

      assert.deepEqual(results, new Set([3, 7]));
      assert.isEmpty(store.storedJobs);
    });

    it('by default, kicks off one job at a time', async () => {
      let maxActive = 0;
      let activeJobCount = 0;
      const updateActiveJobCount = (incrementBy: number): void => {
        activeJobCount += incrementBy;
        maxActive = Math.max(activeJobCount, maxActive);
      };

      class Queue extends JobQueue<number> {
        parseData(data: unknown): number {
          return parseUnknown(z.number(), data);
        }

        async run(): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
          try {
            updateActiveJobCount(1);
            await sleep(1);
          } finally {
            updateActiveJobCount(-1);
          }

          return undefined;
        }
      }

      const store = new TestJobQueueStore();

      const queue = new Queue({
        store,
        queueType: 'test queue',
        maxAttempts: 100,
      });
      drop(queue.streamJobs());

      const createPromise1 = queue.add(1);
      const createPromise2 = queue.add(2);
      const createPromise3 = queue.add(3);
      const createPromise4 = queue.add(4);

      const { completion: promise1 } = await createPromise1;
      const { completion: promise2 } = await createPromise2;
      const { completion: promise3 } = await createPromise3;
      const { completion: promise4 } = await createPromise4;

      await promise1;
      await promise2;
      await promise3;
      await promise4;

      assert.strictEqual(1, maxActive);
    });

    it('can override the in-memory queue', async () => {
      let jobsAdded = 0;
      const testQueue = new PQueue();
      testQueue.on('add', () => {
        jobsAdded += 1;
      });

      class Queue extends JobQueue<number> {
        parseData(data: unknown): number {
          return parseUnknown(z.number(), data);
        }

        protected override getInMemoryQueue(
          parsedJob: ParsedJob<number>
        ): PQueue {
          assert(
            new Set([1, 2, 3, 4]).has(parsedJob.data),
            'Bad data passed to `getInMemoryQueue`'
          );
          return testQueue;
        }

        run(): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
          return Promise.resolve(undefined);
        }
      }

      const store = new TestJobQueueStore();

      const queue = new Queue({
        store,
        queueType: 'test queue',
        maxAttempts: 100,
      });
      drop(queue.streamJobs());

      const jobs = await Promise.all([
        queue.add(1),
        queue.add(2),
        queue.add(3),
        queue.add(4),
      ]);
      await Promise.all(jobs.map(job => job.completion));

      assert.strictEqual(jobsAdded, 4);
    });

    it('writes jobs to the database correctly', async () => {
      const store = new TestJobQueueStore();

      class TestQueue extends JobQueue<string> {
        parseData(data: unknown): string {
          return parseUnknown(z.string(), data);
        }

        async run(): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
          return Promise.resolve(undefined);
        }
      }

      const queue1 = new TestQueue({
        store,
        queueType: 'test 1',
        maxAttempts: 1,
      });
      const queue2 = new TestQueue({
        store,
        queueType: 'test 2',
        maxAttempts: 1,
      });

      store.pauseStream('test 1');
      store.pauseStream('test 2');

      drop(queue1.streamJobs());
      drop(queue2.streamJobs());

      await queue1.add('one');
      await queue2.add('A');
      await queue1.add('two');
      await queue2.add('B');
      await queue1.add('three');

      assert.lengthOf(store.storedJobs, 5);

      const ids = store.storedJobs.map(job => job.id);
      assert.lengthOf(
        store.storedJobs,
        new Set(ids).size,
        'Expected every job to have a unique ID'
      );

      const timestamps = store.storedJobs.map(job => job.timestamp);
      timestamps.forEach(timestamp => {
        assert.approximately(
          timestamp,
          Date.now(),
          3000,
          'Expected the timestamp to be ~now'
        );
      });

      const datas = store.storedJobs.map(job => job.data);
      assert.sameMembers(
        datas,
        ['three', 'two', 'one', 'A', 'B'],
        "Expected every job's data to be stored"
      );

      const queueTypes = groupBy(store.storedJobs, 'queueType');
      assert.hasAllKeys(queueTypes, ['test 1', 'test 2']);
      assert.lengthOf(queueTypes['test 1'], 3);
      assert.lengthOf(queueTypes['test 2'], 2);
    });

    it('can override the insertion logic, skipping storage persistence', async () => {
      const store = new TestJobQueueStore();

      class TestQueue extends JobQueue<string> {
        parseData(data: unknown): string {
          return parseUnknown(z.string(), data);
        }

        async run(): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
          return Promise.resolve(undefined);
        }
      }

      const queue = new TestQueue({
        store,
        queueType: 'test queue',
        maxAttempts: 1,
      });

      drop(queue.streamJobs());

      const insert = sinon.stub().resolves();

      await queue.add('foo bar', insert);

      assert.lengthOf(store.storedJobs, 0);

      sinon.assert.calledOnce(insert);
      sinon.assert.calledWith(
        insert,
        sinon.match({
          id: sinon.match.string,
          timestamp: sinon.match.number,
          queueType: 'test queue',
          data: 'foo bar',
        })
      );
    });

    it('retries jobs, running them up to maxAttempts times', async () => {
      type TestJobData = 'foo' | 'bar';

      let fooAttempts = 0;
      let barAttempts = 0;
      let fooSucceeded = false;

      const store = new TestJobQueueStore();

      class RetryQueue extends JobQueue<TestJobData> {
        parseData(data: unknown): TestJobData {
          if (data !== 'foo' && data !== 'bar') {
            throw new Error('Invalid data');
          }
          return data;
        }

        async run({
          data,
        }: ParsedJob<TestJobData>): Promise<
          typeof JOB_STATUS.NEEDS_RETRY | undefined
        > {
          switch (data) {
            case 'foo':
              fooAttempts += 1;
              if (fooAttempts < 3) {
                throw new Error(
                  'foo job should fail the first and second time'
                );
              }
              fooSucceeded = true;
              break;
            case 'bar':
              barAttempts += 1;
              throw new Error('bar job always fails in this test');
            default:
              throw missingCaseError(data);
          }
          return undefined;
        }
      }

      const retryQueue = new RetryQueue({
        store,
        queueType: 'test retry queue',
        maxAttempts: 5,
      });

      drop(retryQueue.streamJobs());

      await (
        await retryQueue.add('foo')
      ).completion;

      let booErr: unknown;
      try {
        await (
          await retryQueue.add('bar')
        ).completion;
      } catch (err: unknown) {
        booErr = err;
      }

      assert.strictEqual(fooAttempts, 3);
      assert.isTrue(fooSucceeded);

      assert.strictEqual(barAttempts, 5);

      // Chai's `assert.instanceOf` doesn't tell TypeScript anything, so we do it here.
      if (!(booErr instanceof JobError)) {
        assert.fail('Expected error to be a JobError');
      }
      assert.include(booErr.message, 'bar job always fails in this test');

      assert.isEmpty(store.storedJobs);
    });

    it('passes the attempt number to the run function', async () => {
      const attempts: Array<number> = [];

      const store = new TestJobQueueStore();

      class TestQueue extends JobQueue<string> {
        parseData(data: unknown): string {
          return parseUnknown(z.string(), data);
        }

        async run(
          _: unknown,
          { attempt }: Readonly<{ attempt: number }>
        ): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
          attempts.push(attempt);
          throw new Error('this job always fails');
        }
      }

      const queue = new TestQueue({
        store,
        queueType: 'test',
        maxAttempts: 6,
      });

      drop(queue.streamJobs());

      try {
        await (
          await queue.add('foo')
        ).completion;
      } catch (err: unknown) {
        // We expect this to fail.
      }

      assert.deepStrictEqual(attempts, [1, 2, 3, 4, 5, 6]);
    });

    it('passes a logger to the run function', async () => {
      const uniqueString = uuid();

      const fakeLogger = {
        fatal: sinon.fake(),
        error: sinon.fake(),
        warn: sinon.fake(),
        info: sinon.fake(),
        debug: sinon.fake(),
        trace: sinon.fake(),
      };

      class TestQueue extends JobQueue<number> {
        parseData(data: unknown): number {
          return parseUnknown(z.number(), data);
        }

        async run(
          _: unknown,
          { log }: Readonly<{ log: LoggerType }>
        ): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
          log.info(uniqueString);
          log.warn(uniqueString);
          log.error(uniqueString);

          return undefined;
        }
      }

      const queue = new TestQueue({
        store: new TestJobQueueStore(),
        queueType: 'test queue 123',
        maxAttempts: 6,
        logger: fakeLogger,
      });

      drop(queue.streamJobs());

      const job = await queue.add(1);
      await job.completion;

      [fakeLogger.info, fakeLogger.warn, fakeLogger.error].forEach(logFn => {
        sinon.assert.calledWith(
          logFn,
          sinon.match(
            (arg: unknown) =>
              typeof arg === 'string' &&
              arg.includes(job.id) &&
              arg.includes('test queue 123')
          ),
          sinon.match(
            (arg: unknown) =>
              typeof arg === 'string' && arg.includes(uniqueString)
          )
        );
      });
    });

    it('makes job.completion reject if parseData throws', async () => {
      class TestQueue extends JobQueue<string> {
        parseData(data: unknown): string {
          if (data === 'valid') {
            return data;
          }
          throw new Error('uh oh');
        }

        async run(): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
          return Promise.resolve(undefined);
        }
      }

      const queue = new TestQueue({
        store: new TestJobQueueStore(),
        queueType: 'test queue',
        maxAttempts: 999,
      });

      drop(queue.streamJobs());

      const job = await queue.add('this will fail to parse');

      let jobError: unknown;
      try {
        await job.completion;
      } catch (err: unknown) {
        jobError = err;
      }

      // Chai's `assert.instanceOf` doesn't tell TypeScript anything, so we do it here.
      if (!(jobError instanceof JobError)) {
        assert.fail('Expected error to be a JobError');
      }
      assert.include(
        jobError.message,
        'Failed to parse job data. Was unexpected data loaded from the database?'
      );
    });

    it("doesn't run the job if parseData throws", async () => {
      const run = sinon.stub().resolves();

      class TestQueue extends JobQueue<string> {
        parseData(data: unknown): string {
          if (data === 'valid') {
            return data;
          }
          throw new Error('invalid data!');
        }

        run(job: {
          data: string;
        }): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
          return run(job);
        }
      }

      const queue = new TestQueue({
        store: new TestJobQueueStore(),
        queueType: 'test queue',
        maxAttempts: 999,
      });

      drop(queue.streamJobs());

      (await queue.add('invalid')).completion.catch(noop);
      (await queue.add('invalid')).completion.catch(noop);
      await queue.add('valid');
      (await queue.add('invalid')).completion.catch(noop);
      (await queue.add('invalid')).completion.catch(noop);

      sinon.assert.calledOnce(run);
      sinon.assert.calledWithMatch(run, { data: 'valid' });
    });

    it('deletes jobs from storage if parseData throws', async () => {
      const store = new TestJobQueueStore();

      class TestQueue extends JobQueue<string> {
        parseData(data: unknown): string {
          if (data === 'valid') {
            return data;
          }
          throw new Error('invalid data!');
        }

        async run(): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
          return Promise.resolve(undefined);
        }
      }

      const queue = new TestQueue({
        store,
        queueType: 'test queue',
        maxAttempts: 999,
      });

      drop(queue.streamJobs());

      await (await queue.add('invalid 1')).completion.catch(noop);
      await (await queue.add('invalid 2')).completion.catch(noop);
      await queue.add('valid');

      const datas = store.storedJobs.map(job => job.data);
      assert.sameMembers(datas, ['valid']);
    });

    it('adding the job resolves AFTER inserting the job into the database', async () => {
      let inserted = false;

      const store = new TestJobQueueStore();
      store.events.on('insert', () => {
        inserted = true;
      });

      class TestQueue extends JobQueue<undefined> {
        parseData(_: unknown): undefined {
          return undefined;
        }

        async run(): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
          return Promise.resolve(undefined);
        }
      }

      const queue = new TestQueue({
        store,
        queueType: 'test queue',
        maxAttempts: 999,
      });

      drop(queue.streamJobs());

      const addPromise = queue.add(undefined);
      assert.isFalse(inserted);

      await addPromise;
      assert.isTrue(inserted);
    });

    it('starts the job AFTER inserting the job into the database', async () => {
      const events: Array<string> = [];

      const store = new TestJobQueueStore();
      store.events.on('insert', () => {
        events.push('insert');
      });

      class TestQueue extends JobQueue<unknown> {
        parseData(data: unknown): unknown {
          events.push('parsing data');
          return data;
        }

        async run(): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
          events.push('running');
          return undefined;
        }
      }

      const queue = new TestQueue({
        store,
        queueType: 'test queue',
        maxAttempts: 999,
      });

      drop(queue.streamJobs());

      await (
        await queue.add(123)
      ).completion;

      assert.deepEqual(events, ['insert', 'parsing data', 'running']);
    });

    it('resolves job.completion AFTER deleting the job from the database', async () => {
      const events: Array<string> = [];

      const store = new TestJobQueueStore();
      store.events.on('delete', () => {
        events.push('delete');
      });

      class TestQueue extends JobQueue<undefined> {
        parseData(_: unknown): undefined {
          return undefined;
        }

        async run(): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
          return Promise.resolve(undefined);
        }
      }

      const queue = new TestQueue({
        store,
        queueType: 'test queue',
        maxAttempts: 999,
      });

      drop(queue.streamJobs());

      store.pauseStream('test queue');
      const job = await queue.add(undefined);
      // eslint-disable-next-line more/no-then
      const jobCompletionPromise = job.completion.then(() => {
        events.push('resolved');
      });
      assert.lengthOf(store.storedJobs, 1);

      store.resumeStream('test queue');

      await jobCompletionPromise;

      assert.deepEqual(events, ['delete', 'resolved']);
    });

    it('if the job fails after every attempt, rejects job.completion AFTER deleting the job from the database', async () => {
      const events: Array<string> = [];

      const store = new TestJobQueueStore();
      store.events.on('delete', () => {
        events.push('delete');
      });

      class TestQueue extends JobQueue<undefined> {
        parseData(_: unknown): undefined {
          return undefined;
        }

        async run(): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
          events.push('running');
          throw new Error('uh oh');
        }
      }

      const queue = new TestQueue({
        store,
        queueType: 'test queue',
        maxAttempts: 5,
      });

      drop(queue.streamJobs());

      store.pauseStream('test queue');
      const job = await queue.add(undefined);
      const jobCompletionPromise = job.completion.catch(() => {
        events.push('rejected');
      });
      assert.lengthOf(store.storedJobs, 1);

      store.resumeStream('test queue');

      await jobCompletionPromise;

      assert.deepEqual(events, [
        'running',
        'running',
        'running',
        'running',
        'running',
        'delete',
        'rejected',
      ]);
    });
  });

  describe('streamJobs', () => {
    const storedJobSchema = z.object({
      id: z.string(),
      timestamp: z.number(),
      queueType: z.string(),
      data: z.unknown(),
    });

    class FakeStream implements AsyncIterable<StoredJob> {
      #eventEmitter = new EventEmitter();

      async *[Symbol.asyncIterator]() {
        while (true) {
          // eslint-disable-next-line no-await-in-loop
          const [job] = await once(this.#eventEmitter, 'drip');
          yield parseUnknown(storedJobSchema, job as unknown);
        }
      }

      drip(job: Readonly<StoredJob>): void {
        this.#eventEmitter.emit('drip', job);
      }
    }

    let fakeStream: FakeStream;
    let fakeStore: JobQueueStore;

    beforeEach(() => {
      fakeStream = new FakeStream();
      fakeStore = {
        insert: sinon.stub().resolves(),
        delete: sinon.stub().resolves(),
        stream: sinon.stub().returns(fakeStream),
      };
    });

    it('starts streaming jobs from the store', async () => {
      const eventEmitter = new EventEmitter();

      class TestQueue extends JobQueue<number> {
        parseData(data: unknown): number {
          return parseUnknown(z.number(), data);
        }

        async run({
          data,
        }: Readonly<{ data: number }>): Promise<
          typeof JOB_STATUS.NEEDS_RETRY | undefined
        > {
          eventEmitter.emit('run', data);
          return undefined;
        }
      }

      const noopQueue = new TestQueue({
        store: fakeStore,
        queueType: 'test noop queue',
        maxAttempts: 99,
      });

      sinon.assert.notCalled(fakeStore.stream as sinon.SinonStub);

      drop(noopQueue.streamJobs());

      sinon.assert.calledOnce(fakeStore.stream as sinon.SinonStub);

      fakeStream.drip({
        id: uuid(),
        timestamp: Date.now(),
        queueType: 'test noop queue',
        data: 123,
      });
      const [firstRunData] = await once(eventEmitter, 'run');

      fakeStream.drip({
        id: uuid(),
        timestamp: Date.now(),
        queueType: 'test noop queue',
        data: 456,
      });
      const [secondRunData] = await once(eventEmitter, 'run');

      assert.strictEqual(firstRunData, 123);
      assert.strictEqual(secondRunData, 456);
    });

    it('rejects when called more than once', async () => {
      class TestQueue extends JobQueue<unknown> {
        parseData(data: unknown): unknown {
          return data;
        }

        async run(): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
          return Promise.resolve(undefined);
        }
      }

      const noopQueue = new TestQueue({
        store: fakeStore,
        queueType: 'test noop queue',
        maxAttempts: 99,
      });

      drop(noopQueue.streamJobs());

      await assert.isRejected(noopQueue.streamJobs());
      await assert.isRejected(noopQueue.streamJobs());

      sinon.assert.calledOnce(fakeStore.stream as sinon.SinonStub);
    });
  });

  describe('add', () => {
    it('adds even if the job queue has not started streaming', async () => {
      const fakeStore = {
        insert: sinon.stub().resolves(),
        delete: sinon.stub().resolves(),
        stream: sinon.stub(),
      };

      class TestQueue extends JobQueue<undefined> {
        parseData(_: unknown): undefined {
          return undefined;
        }

        async run(): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
          return Promise.resolve(undefined);
        }
      }

      const noopQueue = new TestQueue({
        store: fakeStore,
        queueType: 'test noop queue',
        maxAttempts: 99,
      });

      await noopQueue.add(undefined);

      sinon.assert.notCalled(fakeStore.stream as sinon.SinonStub);
    });
  });
});
