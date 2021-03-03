// tslint:disable: no-implicit-dependencies max-func-body-length no-unused-expression

import chai from 'chai';
import * as sinon from 'sinon';

import { PromiseUtils } from '../../../../session/utils';

// tslint:disable-next-line: no-require-imports no-var-requires
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised as any);
chai.should();

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

      expect(pollSpy.callCount).to.equal(1);
      expect(completionSpy.callCount).to.equal(1);
      return promise;
    });

    it('can timeout a task', () => {
      // completionSpy will be called on done
      const completionSpy = sandbox.spy();
      const task = (_done: any) => undefined;

      const promise = PromiseUtils.poll(task, { timeoutMs: 1 });

      expect(pollSpy.callCount).to.equal(1);
      expect(completionSpy.callCount).to.equal(0);
      return promise.should.eventually.be.rejectedWith(
        'Periodic check timeout'
      );
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

      const promise = PromiseUtils.poll(task, { timeoutMs: timeout, interval });
      await promise;

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

      expect(waitForTaskSpy.callCount).to.equal(1);
      expect(completionSpy.callCount).to.equal(1);
      return promise;
    });

    it('can timeout a task', () => {
      // completionSpy will be called on done
      const completionSpy = sandbox.spy();
      const task = async (_done: any) => undefined;

      const promise = PromiseUtils.waitForTask(task, 1);

      expect(waitForTaskSpy.callCount).to.equal(1);
      expect(completionSpy.callCount).to.equal(0);
      return promise.should.eventually.be.rejectedWith('Task timed out');
    });
  });

  describe('waitUntil', () => {
    it('can wait for check', async () => {
      const check = () => true;
      const promise = PromiseUtils.waitUntil(check);

      expect(waitUntilSpy.callCount).to.equal(1);
      return promise;
    });

    it('can timeout a check', () => {
      const check = () => false;
      const promise = PromiseUtils.waitUntil(check, 1);

      expect(waitUntilSpy.callCount).to.equal(1);
      return promise.should.eventually.be.rejectedWith(
        'Periodic check timeout'
      );
    });
  });
});
