// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as sinon from 'sinon';

import { clearTimeoutIfNecessary } from '../../util/clearTimeoutIfNecessary.std.js';

describe('clearTimeoutIfNecessary', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('does nothing if passed `null` or `undefined`', () => {
    sandbox.stub(global, 'clearTimeout');
    sandbox.stub(global, 'clearInterval');

    clearTimeoutIfNecessary(undefined);
    clearTimeoutIfNecessary(null);

    sinon.assert.notCalled(global.clearTimeout as sinon.SinonSpy);
    sinon.assert.notCalled(global.clearInterval as sinon.SinonSpy);
  });

  it('clears timeouts', async () => {
    const clock = sandbox.useFakeTimers();
    const fn = sinon.fake();
    const timeout = setTimeout(fn, 123);

    clearTimeoutIfNecessary(
      timeout as unknown as ReturnType<typeof setTimeout>
    );

    await clock.tickAsync(9999);
    sinon.assert.notCalled(fn);
  });

  it('clears intervals', async () => {
    const clock = sandbox.useFakeTimers();
    const fn = sinon.fake();
    const interval = setInterval(fn, 123);

    clearTimeoutIfNecessary(
      interval as unknown as ReturnType<typeof setTimeout>
    );

    await clock.tickAsync(9999);
    sinon.assert.notCalled(fn);
  });
});
