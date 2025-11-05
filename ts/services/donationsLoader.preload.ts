// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Donations feature removed
// This file exists as a stub to prevent import errors during the transition

import { getEmptyState } from '../state/ducks/donations.preload.js';
import type { DonationsStateType } from '../state/ducks/donations.preload.js';

export async function loadDonationReceipts(): Promise<void> {
  // No-op stub
}

export function getDonationsForRedux(): DonationsStateType {
  return getEmptyState();
}
