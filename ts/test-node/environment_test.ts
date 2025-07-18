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
    it('returns Environment.PackagedApp for non-strings', () => {
      assert.equal(parseEnvironment(undefined), Environment.PackagedApp);
      assert.equal(parseEnvironment(0), Environment.PackagedApp);
    });

    it('returns Environment.PackagedApp for invalid strings', () => {
      assert.equal(parseEnvironment(''), Environment.PackagedApp);
      assert.equal(parseEnvironment(' development '), Environment.PackagedApp);
      assert.equal(parseEnvironment('PRODUCTION'), Environment.PackagedApp);
    });

    it('parses "development" as Environment.Development', () => {
      assert.equal(parseEnvironment('development'), Environment.Development);
    });

    it('parses "production" as Environment.PackagedApp', () => {
      assert.equal(parseEnvironment('production'), Environment.PackagedApp);
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
      assert.isFalse(isTestEnvironment(Environment.PackagedApp));
      assert.isFalse(isTestEnvironment(Environment.Staging));
    });

    it('returns true for test environments', () => {
      assert.isTrue(isTestEnvironment(Environment.Test));
    });
  });
});
