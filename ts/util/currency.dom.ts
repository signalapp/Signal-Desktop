// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Donations feature removed
// This file exists as a stub to prevent import errors during the transition

export type CurrencyFormatResult = {
  value: string;
  symbol: string;
};

export function getCurrencyFormat(
  amount: number,
  currency: string
): CurrencyFormatResult {
  return {
    value: amount.toString(),
    symbol: currency,
  };
}

export function brandHumanDonationAmount(amount: number): number {
  return amount;
}

export function toHumanCurrencyString(amount: number, currency: string): string {
  return `${amount} ${currency}`;
}

export function parseCurrencyString(value: string, currency: string): number {
  return parseFloat(value) || 0;
}

export function toStripeDonationAmount(amount: number, currency: string): number {
  return Math.round(amount * 100);
}

export function getMaximumStripeAmount(currency: string): number {
  return 999999;
}
