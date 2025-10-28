// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert as chaiAssert } from 'chai';

import { assertDev, strictAssert } from '../../util/assert.std.js';

describe('assert utilities', () => {
  describe('assert', () => {
    it('does nothing if the assertion passes', () => {
      assertDev(true, 'foo bar');
    });

    it("throws if the assertion fails, because we're in a test environment", () => {
      chaiAssert.throws(() => {
        assertDev(false, 'foo bar');
      }, 'foo bar');
    });
  });

  describe('strictAssert', () => {
    it('does nothing if the assertion passes', () => {
      strictAssert(true, 'foo bar');
    });

    it('throws if the assertion fails', () => {
      chaiAssert.throws(() => {
        strictAssert(false, 'foo bar');
      }, 'foo bar');
    });
  });
});
