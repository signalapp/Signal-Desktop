// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as sinon from 'sinon';
import type { LoggerType } from '../../types/Logging.std.ts';
import { WalCheckpoints } from '../../sql/WalCheckpoints.std.ts';

const logger: LoggerType = {
  warn: () => null,
  error: () => null,
  fatal: () => null,
  info: () => null,
  debug: () => null,
  trace: () => null,
  child: () => logger,
};

describe('WalCheckpoints', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox({ useFakeTimers: true });
    WalCheckpoints._reset();
  });

  afterEach(() => {
    WalCheckpoints._reset();
    sandbox.restore();
  });

  describe('_scheduleRun (commit)', () => {
    it('schedules a timer for 30s on first commit', () => {
      const pragma = sinon.stub();
      WalCheckpoints.setOnCheckpointNeeded(pragma);

      WalCheckpoints._scheduleRun('commit', logger);
      sinon.assert.notCalled(pragma);

      sandbox.clock.tick(29_999);
      sinon.assert.notCalled(pragma);

      sandbox.clock.tick(1);
      sinon.assert.calledOnce(pragma);
    });

    it('runs immediately when elapsed >= 30s', async () => {
      const pragma = sinon.stub();
      WalCheckpoints.setOnCheckpointNeeded(pragma);

      await sandbox.clock.tickAsync(30_000);

      WalCheckpoints._scheduleRun('commit', logger);
      sinon.assert.calledOnce(pragma);
    });

    it('does not reschedule when a commit timer is already pending', () => {
      const pragma = sinon.stub();
      WalCheckpoints.setOnCheckpointNeeded(pragma);

      WalCheckpoints._scheduleRun('commit', logger);

      sandbox.clock.tick(29_999);
      WalCheckpoints._scheduleRun('commit', logger);
      sinon.assert.notCalled(pragma);

      sandbox.clock.tick(1);
      // Timer fires exactly once, not twice
      sinon.assert.calledOnce(pragma);
    });
  });

  describe('_scheduleRun (delete)', () => {
    it('schedules a timer for 5s on first delete', () => {
      const pragma = sinon.stub();
      WalCheckpoints.setOnCheckpointNeeded(pragma);

      WalCheckpoints._scheduleRun('delete', logger);
      sinon.assert.notCalled(pragma);

      sandbox.clock.tick(4_999);
      sinon.assert.notCalled(pragma);

      sandbox.clock.tick(1);
      sinon.assert.calledOnce(pragma);
    });

    it('runs immediately when elapsed >= 5s', async () => {
      const pragma = sinon.stub();
      WalCheckpoints.setOnCheckpointNeeded(pragma);

      await sandbox.clock.tickAsync(5_000);

      WalCheckpoints._scheduleRun('delete', logger);
      sinon.assert.calledOnce(pragma);
    });

    it('does not reschedule when a delete timer is already pending', () => {
      const pragma = sinon.stub();
      WalCheckpoints.setOnCheckpointNeeded(pragma);

      WalCheckpoints._scheduleRun('delete', logger);

      sandbox.clock.tick(4_999);
      WalCheckpoints._scheduleRun('delete', logger);
      sinon.assert.notCalled(pragma);

      sandbox.clock.tick(5_000);
      sinon.assert.calledOnce(pragma);
    });

    it('does not reschedule when a commit timer was upgraded to delete', () => {
      const pragma = sinon.stub();
      WalCheckpoints.setOnCheckpointNeeded(pragma);

      WalCheckpoints._scheduleRun('delete', logger);

      sandbox.clock.tick(4_999);
      WalCheckpoints._scheduleRun('commit', logger);
      sinon.assert.notCalled(pragma);

      sandbox.clock.tick(1);
      sinon.assert.calledOnce(pragma);
    });
  });

  describe('delete upgrading a pending commit timer', () => {
    it('fires immediately if already past 5s', () => {
      const pragma = sinon.stub();
      WalCheckpoints.setOnCheckpointNeeded(pragma);

      WalCheckpoints._scheduleRun('commit', logger);

      sandbox.clock.tick(5_000);
      sinon.assert.notCalled(pragma);

      WalCheckpoints._scheduleRun('delete', logger);
      sinon.assert.calledOnce(pragma);
    });

    it('replaces a 30s commit timer with a shorter 5s timer', () => {
      const pragma = sinon.stub();
      WalCheckpoints.setOnCheckpointNeeded(pragma);

      WalCheckpoints._scheduleRun('commit', logger);

      sandbox.clock.tick(4_999);
      sinon.assert.notCalled(pragma);

      WalCheckpoints._scheduleRun('delete', logger);
      sinon.assert.notCalled(pragma);

      sandbox.clock.tick(1);
      sinon.assert.calledOnce(pragma);
    });

    it('does not fire the original 30s commit timer after replacement', () => {
      const pragma = sinon.stub();
      WalCheckpoints.setOnCheckpointNeeded(pragma);

      WalCheckpoints._scheduleRun('commit', logger);

      sandbox.clock.tick(29_999);
      WalCheckpoints._scheduleRun('delete', logger);
      sinon.assert.calledOnce(pragma);

      sandbox.clock.tick(1);
      sinon.assert.calledOnce(pragma);

      sandbox.clock.tick(1);
      sinon.assert.calledOnce(pragma);
    });
  });
});
