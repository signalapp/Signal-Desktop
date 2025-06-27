// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

const donationStateSchema = z.enum([
  'INTENT',
  'INTENT_METHOD',
  'INTENT_CONFIRMED',
  'INTENT_REDIRECT',
  'RECEIPT',
  'RECEIPT_REDEEMED',
]);
export type DonationState = z.infer<typeof donationStateSchema>;

const paymentTypeSchema = z.enum(['CARD', 'PAYPAL']);
export type PaymentType = z.infer<typeof paymentTypeSchema>;

const coreDataSchema = z.object({
  // guid used to prevent duplicates at stripe and in our db.
  // we'll hash it and provide it to stripe as the idempotencyKey: https://docs.stripe.com/error-low-level#idempotency
  id: z.string(),

  // the code, like USD
  currencyType: z.string(),

  // cents as whole numbers, so multiply by 100
  paymentAmount: z.number(),

  // The last time we transitioned into a new state. So the timestamp shown to the user
  // will be when we redeem the receipt, not when they click the button.
  timestamp: z.number(),
});
export type CoreData = z.infer<typeof coreDataSchema>;

// When we add more payment types, this will become a discriminatedUnion like this:
// const paymentDetailSchema = z.discriminatedUnion('paymentType', [
const paymentDetailSchema = z.object({
  paymentType: z.literal(paymentTypeSchema.Enum.CARD),

  // Note: we really don't want this to be null, but sometimes it won't parse, and in
  // that case we still move forward and display the receipt best we can.
  paymentDetail: z
    .object({
      lastFourDigits: z.string(),
    })
    .nullable(),
});
export type PaymentDetails = z.infer<typeof paymentDetailSchema>;

export const donationReceiptSchema = z.intersection(
  z.object({
    ...coreDataSchema.shape,
  }),
  // This type will demand the z.intersection when it is a discriminatedUnion. When
  // it is a discriminatedUnion, we can't use the ...schema.shape approach
  paymentDetailSchema
);
export type DonationReceipt = z.infer<typeof donationReceiptSchema>;
