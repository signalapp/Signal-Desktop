// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { pickBy } from 'lodash';
import type { SubscriptionConfigurationResultType } from '../textsecure/WebAPI.preload.ts';
import { getSubscriptionConfiguration } from '../textsecure/WebAPI.preload.ts';
import {
  PaymentMethod,
  type OneTimeDonationHumanAmounts,
} from '../types/Donations.std.ts';
import { HOUR } from './durations/index.std.ts';
import { isInPast } from './timestamp.std.ts';
import { createLogger } from '../logging/log.std.ts';
import { TaskDeduplicator } from './TaskDeduplicator.std.ts';

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
  // pickBy returns a Partial so we need to cast it
  return pickBy(
    currencies,
    ({ supportedPaymentMethods }) =>
      supportedPaymentMethods.includes(PaymentMethod.Card) ||
      supportedPaymentMethods.includes(PaymentMethod.Paypal)
  ) as unknown as OneTimeDonationHumanAmounts;
}

export async function maybeHydrateDonationConfigCache(): Promise<void> {
  if (!isCacheRefreshNeeded()) {
    return;
  }

  const amounts = await getCachedDonationHumanAmounts();
  window.reduxActions.donations.hydrateConfigCache(amounts);
}
