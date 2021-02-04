// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as chai from 'chai';

import { assert } from '../../util/assert';

describe('assert', () => {
  it('does nothing if the assertion passes', () => {
    assert(true, 'foo bar');
  });

  it("throws because we're in a test environment", () => {
    chai.assert.throws(() => {
      assert(false, 'foo bar');
    }, 'foo bar');
  });
});
