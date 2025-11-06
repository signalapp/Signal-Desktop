// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Donations feature removed
// This file exists as a stub to prevent import errors during the transition

import type { DonationReceipt } from '../../types/Donations.std.js';
import type { ReadableDB, WritableDB } from '../Interface.std.js';

export function createDonationReceipt(
  _db: WritableDB,
  _receipt: DonationReceipt
): void {
  // No-op stub
}

export function getAllDonationReceipts(_db: ReadableDB): Array<DonationReceipt> {
  return [];
}

export function getDonationReceiptById(
  _db: ReadableDB,
  _id: string
): DonationReceipt | undefined {
  return undefined;
}

export function deleteDonationReceiptById(_db: WritableDB, _id: string): void {
  // No-op stub
}

export function _deleteAllDonationReceipts(_db: WritableDB): void {
  // No-op stub
}
