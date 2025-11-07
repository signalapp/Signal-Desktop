// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Currency utilities removed for Orbital (payments feature removed)
// This file provides stub functions to maintain compatibility

export function getCurrencyList(): string[] {
  return [];
}

export function formatCurrency(_amount: number, _currency: string): string {
  return '';
}

export function getHumanDonationAmount(_amount: number, _currency: string): string {
  return '';
}
