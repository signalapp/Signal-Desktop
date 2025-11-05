// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Donations feature removed
// This file exists as a stub to prevent import errors during the transition

import { z } from 'zod';

// Minimal stub types for database compatibility
export const donationReceiptSchema = z.object({
  id: z.string(),
  currencyType: z.string(),
  paymentAmount: z.number(),
  timestamp: z.number(),
});

export type DonationReceipt = z.infer<typeof donationReceiptSchema>;

// Export other minimal stubs to prevent import errors
export const donationStateSchema = z.enum([
  'INTENT',
  'INTENT_METHOD',
  'INTENT_CONFIRMED',
  'INTENT_REDIRECT',
  'RECEIPT',
  'DONE',
]);

export type DonationStateType = z.infer<typeof donationStateSchema>;

export const donationErrorTypeSchema = z.enum([
  'Failed3dsValidation',
  'GeneralError',
  'PaymentDeclined',
  'TimedOut',
  'BadgeApplicationFailed',
]);

export type DonationErrorType = z.infer<typeof donationErrorTypeSchema>;

// Stub for other types
export type DonationWorkflow = never;
export type CardDetail = never;
export type HumanDonationAmount = never;
export type StripeDonationAmount = never;
export type OneTimeDonationHumanAmounts = never;
