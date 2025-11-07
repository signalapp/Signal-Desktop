// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Donations/Payments feature removed
// This file exists as a stub to prevent import errors during the transition

import type { ReadonlyDeep } from 'type-fest';
import type { BadgeType } from '../../badges/types.std.js';

export type DonationsStateType = ReadonlyDeep<{
  currentWorkflow: undefined;
  didResumeWorkflowAtStartup: boolean;
  lastError: undefined;
  receipts: Array<never>;
}>;

export type DonationsActionType = never;

// Stub action creators
export const actions = {
  addReceipt: () => ({ type: 'donations/STUB' as const }),
  applyDonationBadge: ({
    onComplete}: {
    applyBadge: boolean;
    onComplete: (error?: Error) => void;
  }) => {
    // Call onComplete immediately to avoid hanging callbacks
    onComplete(new Error('Donations feature removed'));
    return { type: 'donations/STUB' as const };
  },
  clearWorkflow: () => ({ type: 'donations/STUB' as const }),
  internalAddDonationReceipt: () => ({ type: 'donations/STUB' as const }),
  setDidResume: () => ({ type: 'donations/STUB' as const }),
  resumeWorkflow: () => ({ type: 'donations/STUB' as const }),
  submitDonation: () => ({ type: 'donations/STUB' as const }),
  updateLastError: () => ({ type: 'donations/STUB' as const }),
  updateWorkflow: () => ({ type: 'donations/STUB' as const })};

export const useDonationsActions = () => actions;

export function getEmptyState(): DonationsStateType {
  return {
    currentWorkflow: undefined,
    didResumeWorkflowAtStartup: false,
    lastError: undefined,
    receipts: []};
}

export function reducer(): DonationsStateType {
  return getEmptyState();
}
