// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Donation receipts removed for Orbital
// This file provides stub functions to maintain compatibility

import type { DonationReceipt } from '../../types/Donations.std.js';

export function getAllDonationReceipts(): DonationReceipt[] {
  return [];
}

export function _deleteAllDonationReceipts(): void {
  // No-op: donations feature removed
}

export function addDonationReceipt(_receipt: DonationReceipt): void {
  // No-op: donations feature removed
}

export function createDonationReceipt(_receipt: DonationReceipt): void {
  // No-op: donations feature removed
}

export function deleteDonationReceiptById(_id: string): void {
  // No-op: donations feature removed
}

export function getDonationReceiptById(_id: string): DonationReceipt | null {
  // No-op: donations feature removed
  return null;
}

export function removeDonationReceipt(_id: string): void {
  // No-op: donations feature removed
}
