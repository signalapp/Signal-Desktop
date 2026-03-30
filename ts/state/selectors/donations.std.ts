// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import type { ReadonlyDeep } from 'type-fest';
import type { StateType } from '../reducer.preload.ts';
import type { DonationsStateType } from '../ducks/donations.preload.ts';
import type { OneTimeDonationHumanAmounts } from '../../types/Donations.std.ts';

export const getDonationsState = (
  state: Readonly<StateType>
): DonationsStateType => state.donations;

export const getDonationConfigCache = createSelector(
  getDonationsState,
  ({
    configCache,
  }: Readonly<DonationsStateType>):
    | ReadonlyDeep<OneTimeDonationHumanAmounts>
    | undefined => configCache
);
