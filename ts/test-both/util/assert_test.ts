// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert as chaiAssert } from 'chai';

import { assert, strictAssert } from '../../util/assert';

describe('assert utilities', () => {
  describe('assert', () => {
    it('does nothing if the assertion passes', () => {
      assert(true, 'foo bar');
    });

    it("throws if the assertion fails, because we're in a test environment", () => {
      chaiAssert.throws(() => {
        assert(false, 'foo bar');
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
