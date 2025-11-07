// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Donation receipts removed for Orbital
// This file provides stub functions to maintain compatibility

import type { DonationReceipt } from '../../types/Donations.std.js';
import type { ReadableDB, WritableDB } from '../Interface.std.js';

export function getAllDonationReceipts(_db: ReadableDB): DonationReceipt[] {
  return [];
}

export function _deleteAllDonationReceipts(_db: WritableDB): void {
  // No-op: donations feature removed
}

export function addDonationReceipt(_db: WritableDB, _receipt: DonationReceipt): void {
  // No-op: donations feature removed
}

export function createDonationReceipt(_db: WritableDB, _profile: DonationReceipt): void {
  // No-op: donations feature removed
}

export function deleteDonationReceiptById(_db: WritableDB, _id: string): void {
  // No-op: donations feature removed
}

export function getDonationReceiptById(_db: ReadableDB, _id: string): DonationReceipt | undefined {
  // No-op: donations feature removed
  return undefined;
}

export function removeDonationReceipt(_db: WritableDB, _id: string): void {
  // No-op: donations feature removed
}
