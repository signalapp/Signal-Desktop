// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import parseCurrency from 'parsecurrency';
import type {
  HumanDonationAmount,
  DonationReceipt,
  StripeDonationAmount,
} from '../types/Donations.std.js';
import {
  humanDonationAmountSchema,
  stripeDonationAmountSchema,
} from '../types/Donations.std.js';
import { parseStrict, safeParseStrict } from './schemas.std.js';
import { missingCaseError } from './missingCaseError.std.js';

// See: https://docs.stripe.com/currencies?presentment-currency=US
export const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif',
  'clp',
  'djf',
  'gnf',
  'jpy',
  'kmf',
  'krw',
  'mga',
  'pyg',
  'rwf',
  'vnd',
  'vuv',
  'xaf',
  'xof',
  'xpf',
]);

export function parseCurrencyString({
  currency,
  value,
}: {
  currency: string;
  value: string;
}): HumanDonationAmount | undefined {
  // Known issues with parseCurrency:
  // Triple decimal interpreted as a thousands group separator e.g. 1.000 -> 1000
  // Decimals must have leading 0 or else are parsed as integers e.g. .42 -> 42
  const { value: parsedCurrencyValue } = parseCurrency(value) ?? {};
  if (!parsedCurrencyValue) {
    return;
  }

  const truncatedAmount = ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase())
    ? Math.trunc(parsedCurrencyValue)
    : Math.trunc(parsedCurrencyValue * 100) / 100;

  const parsed = safeParseStrict(humanDonationAmountSchema, truncatedAmount);
  if (!parsed.success) {
    return;
  }

  return parsed.data;
}

function getLocales(): Intl.LocalesArgument {
  const preferredSystemLocales =
    window.SignalContext.getPreferredSystemLocales();
  const localeOverride = window.SignalContext.getLocaleOverride();
  return localeOverride != null ? [localeOverride] : preferredSystemLocales;
}

// Takes a donation amount and currency and returns a human readable currency string
// formatted in the locale's format using Intl.NumberFormat. e.g. $10; ¥1000; 10 €
// In case of error, returns empty string.
export function toHumanCurrencyString({
  amount,
  currency,
  symbol = 'symbol',
  showInsignificantFractionDigits = false,
}: {
  amount: HumanDonationAmount | undefined;
  currency: string | undefined;
  symbol?: 'symbol' | 'narrowSymbol' | 'none';
  showInsignificantFractionDigits?: boolean;
}): string {
  if (amount == null || currency == null) {
    return '';
  }

  try {
    const fractionOptions =
      showInsignificantFractionDigits || amount % 1 !== 0
        ? {}
        : { minimumFractionDigits: 0 };

    let currencyDisplay: 'code' | 'symbol' | 'narrowSymbol';
    if (symbol === 'symbol' || symbol === 'narrowSymbol') {
      currencyDisplay = symbol;
    } else if (symbol === 'none') {
      // we will filter it out later
      currencyDisplay = 'code';
    } else {
      throw missingCaseError(symbol);
    }

    const formatter = new Intl.NumberFormat(getLocales(), {
      style: 'currency',
      currency,
      currencyDisplay,
      ...fractionOptions,
    });
    // replace &nbsp; with space
    const rawResult = formatter.format(amount).replace(/\u00a0/g, ' ');

    if (symbol === 'none') {
      return rawResult.replace(currency.toUpperCase(), '').trim();
    }

    return rawResult;
  } catch {
    return '';
  }
}

export type CurrencyFormatResult = {
  currency: string;
  decimal: string | undefined;
  group: string | undefined;
  symbol: string;
  symbolPrefix: string;
  symbolSuffix: string;
};

export function getCurrencyFormat(
  currency: string
): CurrencyFormatResult | undefined {
  if (currency == null) {
    return;
  }

  try {
    const currencyLowercase = currency.toLowerCase();
    const formatter = new Intl.NumberFormat(getLocales(), {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    });

    let isDigitPresent = false;
    let symbol = '';
    let symbolPrefix = '';
    let symbolSuffix = '';
    let group;
    let decimal;

    const parts = formatter.formatToParts(123456);
    for (const [index, part] of parts.entries()) {
      const { type, value } = part;
      if (type === 'currency') {
        symbol += value;
        if (index === 0) {
          symbolPrefix += part.value;
        } else {
          symbolSuffix += part.value;
        }
      } else if (type === 'literal') {
        symbol += value;
        if (!isDigitPresent) {
          symbolPrefix += part.value;
        } else {
          symbolSuffix += part.value;
        }
      } else if (type === 'group') {
        group = value;
      } else if (type === 'decimal') {
        decimal = value;
      } else if (type === 'integer' || type === 'fraction') {
        if (!isDigitPresent) {
          isDigitPresent = true;
        }
      }
    }

    return {
      currency: currencyLowercase,
      decimal,
      group,
      symbol,
      symbolPrefix,
      symbolSuffix,
    };
  } catch {
    return undefined;
  }
}

/**
 * Takes a number and brands as HumanDonationAmount type, which indicates actual
 * units (e.g. 10 for 10 USD; 1000 for 1000 JPY).
 * Only use this when directly handling amounts from the chat server.
 * To convert from stripe to chat server amount, use toHumanDonationAmount().
 * @param amount - number expressing value as actual currency units (e.g. 10 for 10 USD)
 * @returns HumanDonationAmount - branded number type
 */
export function brandHumanDonationAmount(amount: number): HumanDonationAmount {
  return parseStrict(humanDonationAmountSchema, amount);
}

export function toHumanDonationAmount({
  amount,
  currency,
}: {
  amount: StripeDonationAmount;
  currency: string;
}): HumanDonationAmount {
  const transformedAmount = ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase())
    ? amount
    : amount / 100;
  return parseStrict(humanDonationAmountSchema, transformedAmount);
}

/**
 * Takes a number and brands as StripeDonationAmount type, which is in the currency
 * minor unit (e.g. 1000 for 10 USD) and the expected format for the Stripe API.
 * Only use this when directly handling amounts from Stripe.
 * To convert from chat server to stripe amount, use toStripeDonationAmount().
 * @param amount - number expressing value as currency minor units (e.g. 1000 for 10 USD)
 * @returns StripeDonationAmount - branded number type
 */
export function brandStripeDonationAmount(
  amount: number
): StripeDonationAmount {
  return parseStrict(stripeDonationAmountSchema, amount);
}

export function toStripeDonationAmount({
  amount,
  currency,
}: {
  amount: HumanDonationAmount;
  currency: string;
}): StripeDonationAmount {
  const transformedAmount = ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase())
    ? amount
    : amount * 100;
  return parseStrict(humanDonationAmountSchema, transformedAmount);
}

export function getHumanDonationAmount(
  receipt: DonationReceipt
): HumanDonationAmount {
  // We store receipt.paymentAmount as the Stripe value
  const { currencyType: currency, paymentAmount } = receipt;
  const amount = brandStripeDonationAmount(paymentAmount);
  return toHumanDonationAmount({ amount, currency });
}

export function getMaximumStripeAmount(currency: string): HumanDonationAmount {
  // 8 digits in the minimum currency unit
  const amount = brandStripeDonationAmount(99999999);
  return toHumanDonationAmount({
    amount,
    currency,
  });
}
