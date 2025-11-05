// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Donations feature removed
// This file exists as a stub to prevent import errors during the transition

import type { DonationReceipt } from '../../types/Donations.std.js';
import type { ReadableDB, WritableDB } from '../Interface.std.js';

export function createDonationReceipt(
  db: WritableDB,
  receipt: DonationReceipt
): void {
  // No-op stub
}

export function getAllDonationReceipts(db: ReadableDB): Array<DonationReceipt> {
  return [];
}

export function getDonationReceiptById(
  db: ReadableDB,
  id: string
): DonationReceipt | undefined {
  return undefined;
}

export function deleteDonationReceiptById(db: WritableDB, id: string): void {
  // No-op stub
}

export function _deleteAllDonationReceipts(db: WritableDB): void {
  // No-op stub
}
