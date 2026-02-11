// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { SubscriptionConfigurationResultType } from '../textsecure/WebAPI.preload.js';
import { getSubscriptionConfiguration } from '../textsecure/WebAPI.preload.js';
import type { OneTimeDonationHumanAmounts } from '../types/Donations.std.js';
import { HOUR } from './durations/index.std.js';
import { isInPast } from './timestamp.std.js';
import { createLogger } from '../logging/log.std.js';
import { TaskDeduplicator } from './TaskDeduplicator.std.js';

const log = createLogger('subscriptionConfiguration');

const SUBSCRIPTION_CONFIG_CACHE_TIME = HOUR;

let cachedSubscriptionConfig: SubscriptionConfigurationResultType | undefined;
let cachedSubscriptionConfigExpiresAt: number | undefined;

function isCacheRefreshNeeded(): boolean {
  return (
    cachedSubscriptionConfig == null ||
    cachedSubscriptionConfigExpiresAt == null ||
    isInPast(cachedSubscriptionConfigExpiresAt)
  );
}

export async function getCachedSubscriptionConfiguration(): Promise<SubscriptionConfigurationResultType> {
  return getCachedSubscriptionConfigurationDedup.run();
}

const getCachedSubscriptionConfigurationDedup = new TaskDeduplicator(
  'getCachedSubscriptionConfiguration',
  () => _getCachedSubscriptionConfiguration()
);

export async function _getCachedSubscriptionConfiguration(): Promise<SubscriptionConfigurationResultType> {
  if (isCacheRefreshNeeded()) {
    cachedSubscriptionConfig = undefined;
  }

  if (cachedSubscriptionConfig != null) {
    return cachedSubscriptionConfig;
  }

  log.info('Refreshing config cache');
  const response = await getSubscriptionConfiguration();

  cachedSubscriptionConfig = response;
  cachedSubscriptionConfigExpiresAt =
    Date.now() + SUBSCRIPTION_CONFIG_CACHE_TIME;

  return response;
}

export function getCachedSubscriptionConfigExpiresAt(): number | undefined {
  return cachedSubscriptionConfigExpiresAt;
}

export async function getCachedDonationHumanAmounts(): Promise<OneTimeDonationHumanAmounts> {
  const { currencies } = await getCachedSubscriptionConfiguration();
  return currencies;
}

export async function maybeHydrateDonationConfigCache(): Promise<void> {
  if (!isCacheRefreshNeeded()) {
    return;
  }

  const amounts = await getCachedDonationHumanAmounts();
  window.reduxActions.donations.hydrateConfigCache(amounts);
}
