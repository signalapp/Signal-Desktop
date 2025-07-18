// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader } from '../sql/Client';
import { strictAssert } from '../util/assert';

import { _getWorkflowFromStorage } from './donations';

import type { DonationReceipt } from '../types/Donations';
import type { DonationsStateType } from '../state/ducks/donations';

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
