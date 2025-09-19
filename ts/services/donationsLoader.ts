// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader } from '../sql/Client.js';
import { strictAssert } from '../util/assert.js';

import { _getWorkflowFromStorage } from './donations.js';

import type { DonationReceipt } from '../types/Donations.js';
import type { DonationsStateType } from '../state/ducks/donations.js';

let donationReceipts: Array<DonationReceipt> | undefined;

export async function loadDonationReceipts(): Promise<void> {
  donationReceipts = await DataReader.getAllDonationReceipts();
}

export function getDonationsForRedux(): DonationsStateType {
  strictAssert(
    donationReceipts != null,
    'donation receipts have not been loaded'
  );
  const currentWorkflow = _getWorkflowFromStorage();

  return {
    currentWorkflow,
    didResumeWorkflowAtStartup: Boolean(currentWorkflow),
    lastError: undefined,
    receipts: donationReceipts,
  };
}
