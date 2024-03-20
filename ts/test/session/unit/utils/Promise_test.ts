import chai from 'chai';
import Sinon, * as sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import { PromiseUtils } from '../../../../session/utils';

import {
  allowOnlyOneAtATime,
  hasAlreadyOneAtaTimeMatching,
  sleepFor,
} from '../../../../session/utils/Promise';
import { TestUtils } from '../../../test-utils';
import { enableLogRedirect } from '../../../test-utils/utils';

chai.use(chaiAsPromised as any);
chai.should();

const { expect } = chai;

describe('Promise Utils', () => {
  let pollSpy: sinon.SinonSpy<
    [
      (done: (arg: any) => void) => Promise<void> | void,
      (Partial<PromiseUtils.PollOptions> | undefined)?,
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
    pollSpy = Sinon.spy(PromiseUtils, 'poll');
    waitForTaskSpy = Sinon.spy(PromiseUtils, 'waitForTask');
    waitUntilSpy = Sinon.spy(PromiseUtils, 'waitUntil');
    TestUtils.stubWindowLog();
  });

  afterEach(() => {
    Sinon.restore();
  });

  describe('poll', () => {
    it('will call done on finished', async () => {
      // completionSpy will be called on done
      const completionSpy = Sinon.spy();

      const task = (done: any) => {
        completionSpy();
        done();
      };

      const promise = PromiseUtils.poll(task, { interval: 10 });

      expect(pollSpy.callCount).to.equal(1);
      expect(completionSpy.callCount).to.equal(1);
      return promise;
    });

    it('can timeout a task', () => {
      // completionSpy will be called on done
      const completionSpy = Sinon.spy();
      const task = (_done: any) => undefined;

      const promise = PromiseUtils.poll(task, { timeoutMs: 1, interval: 10 });

      expect(pollSpy.callCount).to.equal(1);
      expect(completionSpy.callCount).to.equal(0);
      return promise.should.eventually.be.rejectedWith('Periodic check timeout');
    });

    it('will recur according to interval option', async () => {
      const expectedRecurrences = 4;
      const timeout = 3000;
      const interval = 3;

      const recurrenceSpy = Sinon.spy();
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
      const completionSpy = Sinon.spy();

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
      const completionSpy = Sinon.spy();
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
      const promise = PromiseUtils.waitUntil(check, 5);

      expect(waitUntilSpy.callCount).to.equal(1);
      return promise;
    });

    it('can timeout a check', () => {
      const check = () => false;
      const promise = PromiseUtils.waitUntil(check, 1);

      expect(waitUntilSpy.callCount).to.equal(1);
      return promise.should.eventually.be.rejectedWith('Periodic check timeout');
    });
  });

  describe('allowOnlyOneAtATime', () => {
    it('start if not running', async () => {
      const spy = sinon.spy(async () => {
        return sleepFor(10);
      });
      await allowOnlyOneAtATime('testing', spy);
      expect(spy.callCount).to.be.eq(1);
    });

    it('starts only once if already running', async () => {
      const spy = sinon.spy(async () => {
        return sleepFor(10);
      });
      void allowOnlyOneAtATime('testing', spy);

      await allowOnlyOneAtATime('testing', spy);
      expect(spy.callCount).to.be.eq(1);
    });

    it('throw if took longer than expected timeout', async () => {
      const spy = sinon.spy(async () => {
        return sleepFor(10);
      });
      try {
        await allowOnlyOneAtATime('testing', spy, 5);
        throw new Error('should not get here');
      } catch (e) {
        console.error(e);
        expect(e).to.be.be.eql(undefined, 'should be undefined');
      }

      expect(spy.callCount).to.be.eq(1);
    });

    it('does not throw if took less than expected timeout', async () => {
      const spy = sinon.spy(async () => {
        return sleepFor(10);
      });
      try {
        await allowOnlyOneAtATime('testing', spy, 15);
        throw new Error('should get here');
      } catch (e) {
        expect(e.message).to.be.be.eql('should get here');
      }

      expect(spy.callCount).to.be.eq(1);
    });
  });

  describe('hasAlreadyOneAtaTimeMatching', () => {
    it('returns true if already started', () => {
      const spy = sinon.spy(async () => {
        return sleepFor(10);
      });
      void allowOnlyOneAtATime('testing', spy);
      expect(hasAlreadyOneAtaTimeMatching('testing')).to.be.eq(true, 'should be true');
    });

    it('returns false if not already started', () => {
      expect(hasAlreadyOneAtaTimeMatching('testing2')).to.be.eq(false, 'should be false');
    });
  });

  it('stubWindowLog is set to false before pushing', () => {
    expect(
      enableLogRedirect,
      'If you see this message, just set `enableLogRedirect` to false in `ts/test/test-utils/utils/stubbing.ts`'
    ).to.be.eq(false);
  });
});
