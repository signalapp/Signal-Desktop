// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import i18n from './i18n.node.js';

import { getMutedUntilText } from '../../util/getMutedUntilText.std.js';

describe('getMutedUntilText', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.useFakeTimers({
      now: new Date(2000, 3, 20, 12, 0, 0),
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('returns an "always" label if passed a large number', () => {
    assert.strictEqual(
      getMutedUntilText(Number.MAX_SAFE_INTEGER, i18n),
      'Muted always'
    );
    assert.strictEqual(getMutedUntilText(Infinity, i18n), 'Muted always');
  });

  it('returns the time if the mute expires later today', () => {
    assert.strictEqual(
      getMutedUntilText(new Date(2000, 3, 20, 18, 30, 0).valueOf(), i18n),
      'Muted until 6:30 PM'
    );
  });

  it('returns the date and time if the mute expires on another day', () => {
    assert.strictEqual(
      getMutedUntilText(new Date(2000, 3, 21, 18, 30, 0).valueOf(), i18n),
      'Muted until 04/21/2000, 6:30 PM'
    );
  });
});
