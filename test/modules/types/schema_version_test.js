// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

require('mocha-testcheck').install();
const { assert } = require('chai');

const SchemaVersion = require('../../../js/modules/types/schema_version');

describe('SchemaVersion', () => {
  describe('isValid', () => {
    check.it('should return true for positive integers', gen.posInt, input => {
      assert.isTrue(SchemaVersion.isValid(input));
    });

    check.it(
      'should return false for any other value',
      gen.primitive.suchThat(value => typeof value !== 'number' || value < 0),
      input => {
        assert.isFalse(SchemaVersion.isValid(input));
      }
    );
  });
});
