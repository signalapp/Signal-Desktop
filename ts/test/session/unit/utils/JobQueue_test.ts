import chai from 'chai';
import { v4 as uuid } from 'uuid';
import chaiAsPromised from 'chai-as-promised';

import { JobQueue } from '../../../../session/utils/JobQueue';
import { TestUtils } from '../../../test-utils';

chai.use(chaiAsPromised as any);

const { assert } = chai;

describe('JobQueue', () => {
  describe('has', () => {
    it('should return the correct value', async () => {
      const queue = new JobQueue();
      const id = 'jobId';

      assert.isFalse(queue.has(id));
      const promise = queue.addWithId(id, async () => TestUtils.timeout(30));
      assert.isTrue(queue.has(id));
      await promise;
      assert.isFalse(queue.has(id));
    });
  });

  describe('addWithId', () => {
    it('should run the jobs concurrently', async () => {
      const input = [
        [10, 10],
        [20, 8],
        [30, 2],
      ];
      const queue = new JobQueue();
      const mapper = async ([value, ms]: Array<number>): Promise<number> =>
        queue.addWithId(uuid(), async () => {
          await TestUtils.timeout(ms);

          return value;
        });

      const start = Date.now();
      await assert.eventually.deepEqual(Promise.all(input.map(mapper)), [10, 20, 30]);
      const timeTaken = Date.now() - start;
      assert.isAtLeast(timeTaken, 20, 'Queue should take at least 100ms to run.');
    });

    it('should return the result of the job', async () => {
      const queue = new JobQueue();
      const success = queue.addWithId(uuid(), async () => {
        await TestUtils.timeout(10);

        return 'success';
      });
      const failure = queue.addWithId(uuid(), async () => {
        await TestUtils.timeout(10);
        throw new Error('failed');
      });

      await assert.eventually.equal(success, 'success');
      await assert.isRejected(failure, /failed/);
    });

    it('should handle sync and async tasks', async () => {
      const queue = new JobQueue();
      const first = queue.addWithId(uuid(), () => 'first');
      const second = queue.addWithId(uuid(), async () => {
        await TestUtils.timeout(10);

        return 'second';
      });
      const third = queue.addWithId(uuid(), () => 'third');

      await assert.eventually.deepEqual(Promise.all([first, second, third]), [
        'first',
        'second',
        'third',
      ]);
    });

    it('should return the previous job if same id was passed', async () => {
      const queue = new JobQueue();
      const id = uuid();
      const job = async () => {
        await TestUtils.timeout(10);

        return 'job1';
      };

      const promise = queue.addWithId(id, job);
      const otherPromise = queue.addWithId(id, () => 'job2');
      await assert.eventually.equal(promise, 'job1');
      await assert.eventually.equal(otherPromise, 'job1');
    });

    it('should remove completed jobs', async () => {
      const queue = new JobQueue();
      const id = uuid();

      const successfullJob = queue.addWithId(id, async () => TestUtils.timeout(10));
      assert.isTrue(queue.has(id));
      await successfullJob;
      assert.isFalse(queue.has(id));

      const failJob = queue.addWithId(id, async () => {
        await TestUtils.timeout(10);
        throw new Error('failed');
      });
      assert.isTrue(queue.has(id));
      await assert.isRejected(failJob, /failed/);
      assert.isFalse(queue.has(id));
    });
  });
});
