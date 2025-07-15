// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  HumanDonationAmount,
  DonationReceipt,
  StripeDonationAmount,
} from '../types/Donations';
import {
  humanDonationAmountSchema,
  stripeDonationAmountSchema,
} from '../types/Donations';
import { parseStrict, safeParseStrict } from './schemas';

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
  const valueAsFloat = parseFloat(value);
  const truncatedAmount = ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase())
    ? Math.trunc(valueAsFloat)
    : Math.trunc(valueAsFloat * 100) / 100;
  const parsed = safeParseStrict(humanDonationAmountSchema, truncatedAmount);
  if (!parsed.success) {
    return;
  }

  return parsed.data;
}

// Takes a donation amount and currency and returns a human readable currency string
// formatted in the locale's format using Intl.NumberFormat. e.g. $10; ¥1000; 10 €
// In case of error, returns empty string.
export function toHumanCurrencyString({
  amount,
  currency,
  showInsignificantFractionDigits = false,
}: {
  amount: HumanDonationAmount | undefined;
  currency: string | undefined;
  showInsignificantFractionDigits?: boolean;
}): string {
  if (amount == null || currency == null) {
    return '';
  }

  try {
    const preferredSystemLocales =
      window.SignalContext.getPreferredSystemLocales();
    const localeOverride = window.SignalContext.getLocaleOverride();
    const locales =
      localeOverride != null ? [localeOverride] : preferredSystemLocales;

    const fractionOptions =
      showInsignificantFractionDigits || amount % 1 !== 0
        ? {}
        : { minimumFractionDigits: 0 };
    const formatter = new Intl.NumberFormat(locales, {
      style: 'currency',
      currency,
      ...fractionOptions,
    });
    return formatter.format(amount);
  } catch {
    return '';
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
