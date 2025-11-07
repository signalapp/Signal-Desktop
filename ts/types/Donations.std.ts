// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Donations feature removed for Orbital
// This file provides stub types to maintain compatibility

export type DonationReceipt = {
  id: string;
  timestamp: number;
  amount: number;
  currency: string;
};

export type DonationReceiptAttributes = DonationReceipt;

export type SubscriptionData = {
  id: string;
  status: string;
};

export type OneTimeDonationData = {
  id: string;
  amount: number;
};

export enum DonationWorkflow {
  OneTime = 'OneTime',
  Subscription = 'Subscription',
}

export type OneTimeDonationHumanAmounts = {
  amounts: number[];
};
