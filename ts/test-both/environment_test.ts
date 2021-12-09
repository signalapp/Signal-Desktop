// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  Environment,
  isTestEnvironment,
  parseEnvironment,
} from '../environment';

describe('environment utilities', () => {
  describe('parseEnvironment', () => {
    it('returns Environment.Production for non-strings', () => {
      assert.equal(parseEnvironment(undefined), Environment.Production);
      assert.equal(parseEnvironment(0), Environment.Production);
    });

    it('returns Environment.Production for invalid strings', () => {
      assert.equal(parseEnvironment(''), Environment.Production);
      assert.equal(parseEnvironment(' development '), Environment.Production);
      assert.equal(parseEnvironment('PRODUCTION'), Environment.Production);
    });

    it('parses "development" as Environment.Development', () => {
      assert.equal(parseEnvironment('development'), Environment.Development);
    });

    it('parses "production" as Environment.Production', () => {
      assert.equal(parseEnvironment('production'), Environment.Production);
    });

    it('parses "staging" as Environment.Staging', () => {
      assert.equal(parseEnvironment('staging'), Environment.Staging);
    });

    it('parses "test" as Environment.Test', () => {
      assert.equal(parseEnvironment('test'), Environment.Test);
    });
  });

  describe('isTestEnvironment', () => {
    it('returns false for non-test environments', () => {
      assert.isFalse(isTestEnvironment(Environment.Development));
      assert.isFalse(isTestEnvironment(Environment.Production));
      assert.isFalse(isTestEnvironment(Environment.Staging));
    });

    it('returns true for test environments', () => {
      assert.isTrue(isTestEnvironment(Environment.Test));
    });
  });
});
