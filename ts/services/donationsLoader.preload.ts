// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader } from '../sql/Client.preload.ts';
import { strictAssert } from '../util/assert.std.ts';

import { _getWorkflowFromStorage } from './donations.preload.ts';

import type { DonationReceipt } from '../types/Donations.std.ts';
import type { DonationsStateType } from '../state/ducks/donations.preload.ts';

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
    lastReturnToken: undefined,
    receipts: donationReceipts,
    configCache: undefined,
  };
}
