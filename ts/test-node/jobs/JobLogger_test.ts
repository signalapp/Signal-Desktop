// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as sinon from 'sinon';

import { JobLogger } from '../../jobs/JobLogger.std.js';

describe('JobLogger', () => {
  const LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;

  const createFakeLogger = () => ({
    fatal: sinon.fake(),
    error: sinon.fake(),
    warn: sinon.fake(),
    info: sinon.fake(),
    debug: sinon.fake(),
    trace: sinon.fake(),

    child: () => createFakeLogger(),
  });

  LEVELS.forEach(level => {
    describe(level, () => {
      it('logs its arguments with a prefix', () => {
        const fakeLogger = createFakeLogger();

        const logger = new JobLogger(
          { id: 'abc', queueType: 'test queue' },
          fakeLogger
        );

        logger.attempt = 123;
        logger[level]('foo', 456);

        sinon.assert.calledOnce(fakeLogger[level]);

        sinon.assert.calledWith(
          fakeLogger[level],
          sinon.match(
            (arg: unknown) =>
              typeof arg === 'string' &&
              arg.includes('test queue') &&
              arg.includes('abc') &&
              arg.includes('123')
          ),
          'foo',
          456
        );

        LEVELS.filter(l => l !== level).forEach(otherLevel => {
          sinon.assert.notCalled(fakeLogger[otherLevel]);
        });
      });
    });
  });
});
