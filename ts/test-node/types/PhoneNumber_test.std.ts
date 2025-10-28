// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { getCountryCode } from '../../types/PhoneNumber.std.js';

describe('types/PhoneNumber', () => {
  describe('#getCountryCode', () => {
    it('returns expected country codes', () => {
      assert.strictEqual(getCountryCode('+12125550000'), 1, 'United States');
      assert.strictEqual(getCountryCode('+442012341234'), 44, 'United Kingdom');
      assert.strictEqual(getCountryCode('+37060112345'), 370, 'Lithuania');
    });

    it('returns undefined for missing phone number', () => {
      assert.strictEqual(getCountryCode(undefined), undefined);
    });

    it('returns undefined for invalid phone number', () => {
      assert.strictEqual(getCountryCode('+2343d23'), undefined);
    });
  });
});
