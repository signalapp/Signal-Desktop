// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  DonationWorkflow,
  HumanDonationAmount,
} from '../types/Donations.std.ts';
import { donationStateSchema } from '../types/Donations.std.ts';
import {
  brandStripeDonationAmount,
  toHumanDonationAmount,
} from './currency.dom.ts';
import { missingCaseError } from './missingCaseError.std.ts';

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
    case donationStateSchema.enum.INTENT_METHOD:
    case donationStateSchema.enum.INTENT_REDIRECT:
    case donationStateSchema.enum.INTENT_CONFIRMED:
    case donationStateSchema.enum.PAYPAL_APPROVED:
    case donationStateSchema.enum.PAYMENT_CONFIRMED:
    case donationStateSchema.enum.RECEIPT: {
      const { currencyType: currency, paymentAmount } = workflow;
      const amount = brandStripeDonationAmount(paymentAmount);
      return {
        amount: toHumanDonationAmount({ amount, currency }),
        currency,
      };
    }
    case donationStateSchema.enum.INTENT:
    case donationStateSchema.enum.PAYPAL_INTENT:
    case donationStateSchema.enum.DONE:
      return;
    default:
      throw missingCaseError(type);
  }
}
