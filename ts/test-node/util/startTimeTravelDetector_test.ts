// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as sinon from 'sinon';

import { startTimeTravelDetector } from '../../util/startTimeTravelDetector';

describe('startTimeTravelDetector', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox({ useFakeTimers: true });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('calls the callback when the time between checks is more than 2 seconds', async () => {
    const callback = sandbox.fake();

    startTimeTravelDetector(callback);

    // Normal clock behavior
    await sandbox.clock.tickAsync(1234);
    await sandbox.clock.tickAsync(5678);
    sinon.assert.notCalled(callback);

    // Time travel ≤2s
    sandbox.clock.setSystemTime(Date.now() + 1000);
    await sandbox.clock.tickAsync(1000);
    sinon.assert.notCalled(callback);
    sandbox.clock.setSystemTime(Date.now() + 1999);
    await sandbox.clock.tickAsync(1);
    sinon.assert.notCalled(callback);

    // Time travel >2s
    sandbox.clock.setSystemTime(Date.now() + 2001);
    await sandbox.clock.nextAsync();
    sinon.assert.calledOnce(callback);
    sandbox.clock.setSystemTime(Date.now() + 9999);
    await sandbox.clock.nextAsync();
    sinon.assert.calledTwice(callback);

    // Normal clock behavior
    await sandbox.clock.tickAsync(9876);
    sinon.assert.calledTwice(callback);
  });

  it('can detect time travel right after initialization', async () => {
    const callback = sandbox.fake();

    startTimeTravelDetector(callback);

    sandbox.clock.setSystemTime(Date.now() + 2001);
    await sandbox.clock.nextAsync();
    sinon.assert.calledOnce(callback);
  });
});
