// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader } from '../sql/Client';
import { strictAssert } from '../util/assert';

import type { DonationReceipt } from '../types/Donations';
import type { DonationsStateType } from '../state/ducks/donations';

let donationReceipts: Array<DonationReceipt> | undefined;

export async function loadDonationReceipts(): Promise<void> {
  donationReceipts = await DataReader.getAllDonationReceipts();
}

export function getDonationReceiptsForRedux(): DonationsStateType {
  strictAssert(
    donationReceipts != null,
    'donation receipts have not been loaded'
  );
  return {
    receipts: donationReceipts,
  };
}
