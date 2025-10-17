// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { SubscriptionConfigurationResultType } from '../textsecure/WebAPI.preload.js';
import { getSubscriptionConfiguration } from '../textsecure/WebAPI.preload.js';
import type { OneTimeDonationHumanAmounts } from '../types/Donations.std.js';
import { HOUR } from './durations/index.std.js';
import { isInPast } from './timestamp.std.js';

const SUBSCRIPTION_CONFIG_CACHE_TIME = HOUR;

let cachedSubscriptionConfig: SubscriptionConfigurationResultType | undefined;
let cachedSubscriptionConfigExpiresAt: number | undefined;

export async function getCachedSubscriptionConfiguration(): Promise<SubscriptionConfigurationResultType> {
  if (
    cachedSubscriptionConfigExpiresAt != null &&
    isInPast(cachedSubscriptionConfigExpiresAt)
  ) {
    cachedSubscriptionConfig = undefined;
  }

  if (cachedSubscriptionConfig != null) {
    return cachedSubscriptionConfig;
  }

  const response = await getSubscriptionConfiguration();

  cachedSubscriptionConfig = response;
  cachedSubscriptionConfigExpiresAt =
    Date.now() + SUBSCRIPTION_CONFIG_CACHE_TIME;

  return response;
}

export async function getDonationHumanAmounts(): Promise<OneTimeDonationHumanAmounts> {
  const { currencies } = await getCachedSubscriptionConfiguration();
  return currencies;
}
