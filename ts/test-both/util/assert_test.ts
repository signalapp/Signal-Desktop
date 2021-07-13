// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as chai from 'chai';

import { assert, strictAssert } from '../../util/assert';

describe('assert utilities', () => {
  describe('assert', () => {
    it('does nothing if the assertion passes', () => {
      assert(true, 'foo bar');
    });

    it("throws if the assertion fails, because we're in a test environment", () => {
      chai.assert.throws(() => {
        assert(false, 'foo bar');
      }, 'foo bar');
    });
  });

  describe('strictAssert', () => {
    it('does nothing if the assertion passes', () => {
      strictAssert(true, 'foo bar');
    });

    it('throws if the assertion fails', () => {
      chai.assert.throws(() => {
        strictAssert(false, 'foo bar');
      }, 'foo bar');
    });
  });
});
