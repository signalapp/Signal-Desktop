import chai from 'chai';
import * as sinon from 'sinon';

import { PromiseUtils } from '../../../session/utils/';

// tslint:disable-next-line: no-require-imports no-var-requires
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const { expect } = chai;

describe('Promise Utils', () => {
  const sandbox = sinon.createSandbox();
  let pollSpy: sinon.SinonSpy<
    [
      (done: (arg: any) => void) => Promise<void> | void,
      (Partial<PromiseUtils.PollOptions> | undefined)?
    ],
    Promise<void>
  >;
  let waitForTaskSpy: sinon.SinonSpy<
    [(done: (arg: any) => void) => Promise<void> | void, (number | undefined)?],
    Promise<unknown>
  >;
  let waitUntilSpy: sinon.SinonSpy<
    [() => Promise<boolean> | boolean, (number | undefined)?],
    Promise<void>
  >;

  beforeEach(() => {
    pollSpy = sandbox.spy(PromiseUtils, 'poll');
    waitForTaskSpy = sandbox.spy(PromiseUtils, 'waitForTask');
    waitUntilSpy = sandbox.spy(PromiseUtils, 'waitUntil');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('poll', () => {
    it('will call done on finished', async () => {
      // completionSpy will be called on done
      const completionSpy = sandbox.spy();

      // tslint:disable-next-line: mocha-unneeded-done
      const task = (done: any) => {
        completionSpy();
        done();
      };

      const promise = PromiseUtils.poll(task, {});

      await expect(promise).to.be.fulfilled;
      expect(pollSpy.callCount).to.equal(1);
      expect(completionSpy.callCount).to.equal(1);
    });

    it('can timeout a task', async () => {
      // completionSpy will be called on done
      const completionSpy = sandbox.spy();
      const task = (_done: any) => undefined;

      const promise = PromiseUtils.poll(task, { timeout: 1 });

      await expect(promise).to.be.rejectedWith('Periodic check timeout');
      expect(pollSpy.callCount).to.equal(1);
      expect(completionSpy.callCount).to.equal(0);
    });

    it('will recur according to interval option', async () => {
      const expectedRecurrences = 4;
      const timeout = 3000;
      const interval = 50;

      const recurrenceSpy = sandbox.spy();
      const task = (done: any) => {
        recurrenceSpy();

        // Done after we've been called `expectedRecurrences` times
        if (recurrenceSpy.callCount === expectedRecurrences) {
          done();
        }
      };

      const promise = PromiseUtils.poll(task, { timeout, interval });

      await expect(promise).to.be.fulfilled;
      expect(pollSpy.callCount).to.equal(1);
      expect(recurrenceSpy.callCount).to.equal(expectedRecurrences);
    });
  });

  describe('waitForTask', () => {
    it('can wait for a task', async () => {
      // completionSpy will be called on done
      const completionSpy = sandbox.spy();

      // tslint:disable-next-line: mocha-unneeded-done
      const task = (done: any) => {
        completionSpy();
        done();
      };

      const promise = PromiseUtils.waitForTask(task);

      await expect(promise).to.be.fulfilled;
      expect(waitForTaskSpy.callCount).to.equal(1);
      expect(completionSpy.callCount).to.equal(1);
    });

    it('can timeout a task', async () => {
      // completionSpy will be called on done
      const completionSpy = sandbox.spy();
      const task = async (_done: any) => undefined;

      const promise = PromiseUtils.waitForTask(task, 1);

      await expect(promise).to.be.rejectedWith('Task timed out.');
      expect(waitForTaskSpy.callCount).to.equal(1);
      expect(completionSpy.callCount).to.equal(0);
    });
  });

  describe('waitUntil', () => {
    it('can wait for check', async () => {
      const check = () => true;
      const promise = PromiseUtils.waitUntil(check);

      await expect(promise).to.be.fulfilled;
      expect(waitUntilSpy.callCount).to.equal(1);
    });

    it('can timeout a check', async () => {
      const check = () => false;
      const promise = PromiseUtils.waitUntil(check, 1);

      await expect(promise).to.be.rejectedWith('Periodic check timeout');
      expect(waitUntilSpy.callCount).to.equal(1);
    });
  });
});
