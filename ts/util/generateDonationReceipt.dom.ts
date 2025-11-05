// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Donations feature removed
// This file exists as a stub to prevent import errors during the transition

import type { DonationReceipt } from '../types/Donations.std.js';

export async function generateDonationReceiptBlob(
  receipt: DonationReceipt,
  i18n: unknown
): Promise<Blob> {
  // Return empty blob as stub
  return new Blob([''], { type: 'text/plain' });
}
