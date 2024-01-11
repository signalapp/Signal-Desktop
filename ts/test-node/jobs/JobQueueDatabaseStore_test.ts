// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-unreachable-loop */

import { assert } from 'chai';
import * as sinon from 'sinon';
import { noop } from 'lodash';
import type { StoredJob } from '../../jobs/types';

import { JobQueueDatabaseStore } from '../../jobs/JobQueueDatabaseStore';

describe('JobQueueDatabaseStore', () => {
  let fakeDatabase: {
    getJobsInQueue: sinon.SinonStub;
    insertJob: sinon.SinonStub;
    deleteJob: sinon.SinonStub;
  };

  beforeEach(() => {
    fakeDatabase = {
      getJobsInQueue: sinon.stub().resolves([]),
      insertJob: sinon.stub(),
      deleteJob: sinon.stub(),
    };
  });

  describe('insert', () => {
    it("adds jobs to database even if streaming hasn't started yet", async () => {
      const store = new JobQueueDatabaseStore(fakeDatabase);

      await store.insert({
        id: 'abc',
        timestamp: 1234,
        queueType: 'test queue',
        data: { hi: 5 },
      });

      sinon.assert.calledOnce(fakeDatabase.insertJob);
      sinon.assert.calledWithMatch(fakeDatabase.insertJob, {
        id: 'abc',
        timestamp: 1234,
        queueType: 'test queue',
        data: { hi: 5 },
      });
    });

    it('adds jobs to the database', async () => {
      const store = new JobQueueDatabaseStore(fakeDatabase);
      store.stream('test queue');

      await store.insert({
        id: 'abc',
        timestamp: 1234,
        queueType: 'test queue',
        data: { hi: 5 },
      });

      sinon.assert.calledOnce(fakeDatabase.insertJob);
      sinon.assert.calledWithMatch(fakeDatabase.insertJob, {
        id: 'abc',
        timestamp: 1234,
        queueType: 'test queue',
        data: { hi: 5 },
      });
    });

    it('enqueues jobs after putting them in the database', async () => {
      const events: Array<string> = [];

      fakeDatabase.insertJob.callsFake(() => {
        events.push('insert');
      });

      const store = new JobQueueDatabaseStore(fakeDatabase);

      const streamPromise = (async () => {
        // We don't actually care about using the variable from the async iterable.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _job of store.stream('test queue')) {
          events.push('yielded job');
          break;
        }
      })();

      await store.insert({
        id: 'abc',
        timestamp: 1234,
        queueType: 'test queue',
        data: { hi: 5 },
      });

      await streamPromise;

      assert.deepEqual(events, ['insert', 'yielded job']);
    });

    it('can skip the database', async () => {
      const store = new JobQueueDatabaseStore(fakeDatabase);

      const streamPromise = (async () => {
        // We don't actually care about using the variable from the async iterable.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _job of store.stream('test queue')) {
          break;
        }
      })();

      await store.insert(
        {
          id: 'abc',
          timestamp: 1234,
          queueType: 'test queue',
          data: { hi: 5 },
        },
        { shouldPersist: false }
      );

      await streamPromise;

      sinon.assert.notCalled(fakeDatabase.insertJob);
    });

    it("doesn't insert jobs until the initial fetch has completed", async () => {
      const events: Array<string> = [];

      let resolveGetJobsInQueue = noop;
      const getJobsInQueuePromise = new Promise(resolve => {
        resolveGetJobsInQueue = resolve;
      });

      fakeDatabase.getJobsInQueue.callsFake(() => {
        events.push('loaded jobs');
        return getJobsInQueuePromise;
      });
      fakeDatabase.insertJob.callsFake(() => {
        events.push('insert');
      });

      const store = new JobQueueDatabaseStore(fakeDatabase);
      store.stream('test queue');

      const insertPromise = store.insert({
        id: 'abc',
        timestamp: 1234,
        queueType: 'test queue',
        data: { hi: 5 },
      });

      sinon.assert.notCalled(fakeDatabase.insertJob);

      resolveGetJobsInQueue([]);
      await insertPromise;

      sinon.assert.calledOnce(fakeDatabase.insertJob);
      assert.deepEqual(events, ['loaded jobs', 'insert']);
    });

    it("adds jobs if we haven't started streaming at all", async () => {
      const events: Array<string> = [];

      fakeDatabase.insertJob.callsFake(() => {
        events.push('insert');
      });

      const store = new JobQueueDatabaseStore(fakeDatabase);

      await store.insert({
        id: 'abc',
        timestamp: 1234,
        queueType: 'test queue',
        data: { hi: 5 },
      });

      sinon.assert.calledOnce(fakeDatabase.insertJob);
      assert.deepEqual(events, ['insert']);
    });
  });

  describe('delete', () => {
    it('deletes jobs from the database', async () => {
      const store = new JobQueueDatabaseStore(fakeDatabase);

      await store.delete('xyz');

      sinon.assert.calledOnce(fakeDatabase.deleteJob);
      sinon.assert.calledWith(fakeDatabase.deleteJob, 'xyz');
    });
  });

  describe('stream', () => {
    it('yields all values in the database, then all values inserted', async () => {
      const makeJob = (id: string, queueType: string) => ({
        id,
        timestamp: Date.now(),
        queueType,
        data: { hi: 5 },
      });

      const ids = async (
        stream: AsyncIterable<StoredJob>,
        amount: number
      ): Promise<Array<string>> => {
        const result: Array<string> = [];
        for await (const job of stream) {
          result.push(job.id);
          if (result.length >= amount) {
            break;
          }
        }
        return result;
      };

      fakeDatabase.getJobsInQueue
        .withArgs('queue A')
        .resolves([
          makeJob('A.1', 'queue A'),
          makeJob('A.2', 'queue A'),
          makeJob('A.3', 'queue A'),
        ]);

      fakeDatabase.getJobsInQueue.withArgs('queue B').resolves([]);

      fakeDatabase.getJobsInQueue
        .withArgs('queue C')
        .resolves([makeJob('C.1', 'queue C'), makeJob('C.2', 'queue C')]);

      const store = new JobQueueDatabaseStore(fakeDatabase);

      const streamA = store.stream('queue A');
      const streamB = store.stream('queue B');
      const streamC = store.stream('queue C');

      await store.insert(makeJob('A.4', 'queue A'));
      await store.insert(makeJob('C.3', 'queue C'));
      await store.insert(makeJob('B.1', 'queue B'));
      await store.insert(makeJob('A.5', 'queue A'));

      const streamAIds = await ids(streamA, 5);
      const streamBIds = await ids(streamB, 1);
      const streamCIds = await ids(streamC, 3);
      assert.deepEqual(streamAIds, ['A.1', 'A.2', 'A.3', 'A.4', 'A.5']);
      assert.deepEqual(streamBIds, ['B.1']);
      assert.deepEqual(streamCIds, ['C.1', 'C.2', 'C.3']);

      sinon.assert.calledThrice(fakeDatabase.getJobsInQueue);
    });
  });
});
