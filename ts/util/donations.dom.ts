// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  DonationWorkflow,
  HumanDonationAmount,
} from '../types/Donations.std.js';
import { donationStateSchema } from '../types/Donations.std.js';
import {
  brandStripeDonationAmount,
  toHumanDonationAmount,
} from './currency.dom.js';
import { missingCaseError } from './missingCaseError.std.js';

// Donation where we started backend processing, but did not redeem a badge yet.
// Note we skip workflows in the INTENT state because it requires user confirmation
// to proceed.
export function getInProgressDonation(workflow: DonationWorkflow | undefined):
  | {
      amount: HumanDonationAmount;
      currency: string;
    }
  | undefined {
  if (workflow == null) {
    return;
  }

  const { type } = workflow;
  switch (type) {
    case donationStateSchema.Enum.INTENT_METHOD:
    case donationStateSchema.Enum.INTENT_REDIRECT:
    case donationStateSchema.Enum.INTENT_CONFIRMED:
    case donationStateSchema.Enum.RECEIPT: {
      const { currencyType: currency, paymentAmount } = workflow;
      const amount = brandStripeDonationAmount(paymentAmount);
      return {
        amount: toHumanDonationAmount({ amount, currency }),
        currency,
      };
    }
    case donationStateSchema.Enum.INTENT:
    case donationStateSchema.Enum.DONE:
      return;
    default:
      throw missingCaseError(type);
  }
}
