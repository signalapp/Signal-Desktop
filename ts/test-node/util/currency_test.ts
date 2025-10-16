// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  brandHumanDonationAmount,
  brandStripeDonationAmount,
  parseCurrencyString,
  toHumanDonationAmount,
  toHumanCurrencyString,
  toStripeDonationAmount,
} from '../../util/currency.dom.js';

describe('parseCurrencyString', () => {
  function testFn(
    { currency, value }: { currency: string; value: string },
    expectedOutput: number | undefined
  ): void {
    const brandedOutput =
      expectedOutput == null
        ? undefined
        : brandHumanDonationAmount(expectedOutput);
    assert.equal(parseCurrencyString({ currency, value }), brandedOutput);
  }

  it('handles USD', () => {
    testFn({ currency: 'usd', value: '10' }, 10);
    testFn({ currency: 'usd', value: '10.0' }, 10);
    testFn({ currency: 'usd', value: '10.00' }, 10);
    testFn({ currency: 'usd', value: '10.50' }, 10.5);
    testFn({ currency: 'usd', value: '0.69' }, 0.69);
    testFn({ currency: 'usd', value: '$10' }, 10);
    testFn({ currency: 'usd', value: '$10.00' }, 10);
    testFn({ currency: 'usd', value: '$0.69' }, 0.69);
    testFn({ currency: 'usd', value: '$14,000.50' }, 14000.5);
    testFn({ currency: 'usd', value: '$1,000,000' }, 1000000);
  });

  it('handles JPY', () => {
    testFn({ currency: 'jpy', value: '1000' }, 1000);
    testFn({ currency: 'jpy', value: '1000.0' }, 1000);
    testFn({ currency: 'jpy', value: '1000.5' }, 1000);
    testFn({ currency: 'jpy', value: '1000.55' }, 1000);
    testFn({ currency: 'jpy', value: '¥1000' }, 1000);
    testFn({ currency: 'jpy', value: '¥1,000' }, 1000);
  });

  it('handles EUR', () => {
    testFn({ currency: 'eur', value: '€10' }, 10);
    testFn({ currency: 'eur', value: '10€' }, 10);
    testFn({ currency: 'eur', value: '€14.000,50' }, 14000.5);
    testFn({ currency: 'eur', value: '€14,000.5' }, 14000.5);
  });

  it('handles SEK', () => {
    testFn({ currency: 'sek', value: '14 000,99 kr' }, 14000.99);
  });

  it('handles malformed input', () => {
    testFn({ currency: 'usd', value: '' }, undefined);
    testFn({ currency: 'usd', value: '??' }, undefined);
    testFn({ currency: 'usd', value: '-50' }, undefined);
    testFn({ currency: 'usd', value: 'abc' }, undefined);
    testFn({ currency: 'usd', value: '$' }, undefined);
  });
});

describe('toHumanDonationAmount', () => {
  function testFn(
    { amount, currency }: { amount: number; currency: string },
    expectedOutput: number
  ): void {
    const stripeAmount = brandStripeDonationAmount(amount);
    const brandedOutput = brandHumanDonationAmount(expectedOutput);
    assert.equal(
      toHumanDonationAmount({ amount: stripeAmount, currency }),
      brandedOutput
    );
  }

  it('handles USD', () => {
    testFn({ amount: 1000, currency: 'usd' }, 10);
    testFn({ amount: 1000, currency: 'USD' }, 10);
  });

  it('handles JPY', () => {
    testFn({ amount: 1000, currency: 'jpy' }, 1000);
    testFn({ amount: 1000, currency: 'JPY' }, 1000);
  });

  it('handles KRW', () => {
    testFn({ amount: 10000, currency: 'krw' }, 10000);
    testFn({ amount: 10000, currency: 'KRW' }, 10000);
  });
});

describe('toStripeDonationAmount', () => {
  function testFn(
    { amount, currency }: { amount: number; currency: string },
    expectedOutput: number
  ): void {
    const humanAmount = brandHumanDonationAmount(amount);
    const brandedOutput = brandStripeDonationAmount(expectedOutput);
    assert.equal(
      toStripeDonationAmount({ amount: humanAmount, currency }),
      brandedOutput
    );
  }

  it('handles USD', () => {
    testFn({ amount: 10, currency: 'usd' }, 1000);
    testFn({ amount: 10, currency: 'USD' }, 1000);
  });

  it('handles JPY', () => {
    testFn({ amount: 1000, currency: 'jpy' }, 1000);
    testFn({ amount: 1000, currency: 'JPY' }, 1000);
  });

  it('handles KRW', () => {
    testFn({ amount: 10000, currency: 'krw' }, 10000);
    testFn({ amount: 10000, currency: 'KRW' }, 10000);
  });
});

describe('toHumanCurrencyString', () => {
  function testFn(
    {
      amount,
      currency,
      symbol = 'symbol',
      showInsignificantFractionDigits = false,
    }: {
      amount: number;
      currency: string;
      symbol?: 'symbol' | 'narrowSymbol' | 'none';
      showInsignificantFractionDigits?: boolean;
    },
    expectedOutput: string | undefined
  ): void {
    const humanAmount = brandHumanDonationAmount(amount);
    assert.equal(
      toHumanCurrencyString({
        amount: humanAmount,
        currency,
        symbol,
        showInsignificantFractionDigits,
      }),
      expectedOutput
    );
  }

  it('handles USD', () => {
    testFn(
      { amount: 10, currency: 'usd', showInsignificantFractionDigits: true },
      '$10.00'
    );
    testFn({ amount: 10, currency: 'USD' }, '$10');
    testFn({ amount: 10.5, currency: 'USD' }, '$10.50');
    testFn({ amount: 10.5, currency: 'USD' }, '$10.50');
    testFn({ amount: 10.69, currency: 'USD' }, '$10.69');
    testFn({ amount: 10.5, currency: 'USD', symbol: 'none' }, '10.50');
  });

  it('handles CAD', () => {
    testFn({ amount: 10, currency: 'CAD' }, 'CA$10');
    testFn({ amount: 10, currency: 'CAD', symbol: 'narrowSymbol' }, '$10');
  });

  it('handles EUR', () => {
    testFn(
      { amount: 10, currency: 'eur', showInsignificantFractionDigits: true },
      '€10.00'
    );
    testFn({ amount: 10, currency: 'eur' }, '€10');
  });

  it('handles JPY', () => {
    testFn({ amount: 1000, currency: 'jpy' }, '¥1,000');
    testFn(
      { amount: 1000, currency: 'JPY', showInsignificantFractionDigits: true },
      '¥1,000'
    );
  });

  it('returns empty string for bad inputs', () => {
    testFn({ amount: 10, currency: '420' }, '');
    testFn({ amount: 10, currency: '' }, '');
  });
});
