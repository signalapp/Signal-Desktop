// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { phoneNumberToCurrencyCode } from '../../services/donations.preload.js';

describe('donations', () => {
  describe('phoneNumberToCurrency', () => {
    it('handles US phone number', async () => {
      assert.strictEqual(phoneNumberToCurrencyCode('+18055550000'), 'USD');
    });
    it('handles Canada phone number', async () => {
      assert.strictEqual(phoneNumberToCurrencyCode('+17805550000'), 'CAD');
    });
    it('handles Puerto Rico phone number', async () => {
      assert.strictEqual(phoneNumberToCurrencyCode('+17875550000'), 'USD');
    });
    it('handles Guam phone number', async () => {
      assert.strictEqual(phoneNumberToCurrencyCode('+16715550000'), 'USD');
    });
    it('handles Aruba phone number', async () => {
      assert.strictEqual(phoneNumberToCurrencyCode('+2972870550'), 'AWG');
    });
    it('handles New Zealand phone number', async () => {
      assert.strictEqual(phoneNumberToCurrencyCode('+6492221111;'), 'NZD');
    });
  });
});
