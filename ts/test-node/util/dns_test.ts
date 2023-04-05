// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import { DNSCache } from '../../util/dns';
import { SECOND } from '../../util/durations';

const NOW = 1680726906000;

describe('dns/DNSCache', () => {
  let sandbox: sinon.SinonSandbox;
  let cache: DNSCache;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    cache = new DNSCache();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should cache records and pick a random one', () => {
    sandbox.useFakeTimers({
      now: NOW,
    });

    const result = cache.setAndPick('signal.org', 4, [
      {
        data: '10.0.0.1',
        expiresAt: NOW + SECOND,
      },
      {
        data: '10.0.0.2',
        expiresAt: NOW + SECOND,
      },
    ]);

    assert.oneOf(result, ['10.0.0.1', '10.0.0.2']);
  });

  it('should invalidate cache after expiration', () => {
    const clock = sandbox.useFakeTimers({
      now: NOW,
    });

    cache.setAndPick('signal.org', 4, [
      {
        data: '10.0.0.1',
        expiresAt: NOW + SECOND,
      },
      {
        data: '10.0.0.2',
        expiresAt: NOW + 2 * SECOND,
      },
    ]);

    assert.oneOf(cache.get('signal.org', 4), ['10.0.0.1', '10.0.0.2']);

    clock.tick(SECOND);
    assert.strictEqual(cache.get('signal.org', 4), '10.0.0.2');

    clock.tick(SECOND);
    assert.strictEqual(cache.get('signal.org', 4), undefined);
  });
});
