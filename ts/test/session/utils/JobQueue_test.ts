import chai from 'chai';
import { v4 as uuid } from 'uuid';
import { JobQueue } from '../../../session/utils/JobQueue';
import { delay } from '../../utils/delay';

// tslint:disable-next-line: no-require-imports no-var-requires
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const { assert } = chai;

describe('JobQueue', () => {
  describe('has', () => {
    it('should return the correct value', async () => {
      const queue = new JobQueue();
      const id = 'jobId';

      assert.isFalse(queue.has(id));
      const promise = queue.addWithId(id, async () => delay(100));
      assert.isTrue(queue.has(id));
      await promise;
      assert.isFalse(queue.has(id));
    });
  });

  describe('addWithId', () => {
    it('should run the jobs concurrently', async () => {
      const input = [[10, 300], [20, 200], [30, 100]];
      const queue = new JobQueue();
      const mapper = async ([value, ms]: Array<number>): Promise<number> =>
        queue.addWithId(uuid(), async () => {
          await delay(ms);

          return value;
        });

      const start = Date.now();
      assert.deepEqual(await Promise.all(input.map(mapper)), [10, 20, 30]);
      const timeTaken = Date.now() - start;
      assert.closeTo(timeTaken, 600, 50, 'Queue was delayed');
    });

    it('should return the result of the job', async () => {
      const queue = new JobQueue();
      const success = queue.addWithId(uuid(), async () => {
        await delay(100);

        return 'success';
      });
      const failure = queue.addWithId(uuid(), async () => {
        await delay(100);
        throw new Error('failed');
      });

      assert.equal(await success, 'success');
      await assert.isRejected(failure, /failed/);
    });

    it('should handle sync and async tasks', async () => {
      const queue = new JobQueue();
      const first = queue.addWithId(uuid(), () => 'first');
      const second = queue.addWithId(uuid(), async () => {
        await delay(100);

        return 'second';
      });
      const third = queue.addWithId(uuid(), () => 'third');

      assert.deepEqual(await Promise.all([first, second, third]), [
        'first',
        'second',
        'third',
      ]);
    });

    it('should return the previous job if same id was passed', async () => {
      const queue = new JobQueue();
      const id = uuid();
      const job = async () => {
        await delay(100);

        return 'job1';
      };

      const promise = queue.addWithId(id, job);
      const otherPromise = queue.addWithId(id, () => 'job2');
      assert.equal(await promise, await otherPromise);
      await promise;
    });

    it('should remove completed jobs', async () => {
      const queue = new JobQueue();
      const id = uuid();

      const successfullJob = queue.addWithId(id, async () => delay(100));
      assert.isTrue(queue.has(id));
      await successfullJob;
      assert.isFalse(queue.has(id));

      const failJob = queue.addWithId(id, async () => {
        await delay(100);
        throw new Error('failed');
      });
      assert.isTrue(queue.has(id));
      await assert.isRejected(failJob, /failed/);
      assert.isFalse(queue.has(id));
    });
  });
});
