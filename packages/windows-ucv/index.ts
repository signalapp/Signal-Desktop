// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import loadBinding from 'bindings';

export type Availability =
  | 'available'
  | 'deviceBusy'
  | 'deviceNotPresent'
  | 'disabledByPolicy'
  | 'notConfiguredForUser'
  | 'unknown';

export type Verification =
  | 'verified'
  | 'deviceBusy'
  | 'deviceNotPresent'
  | 'disabledByPolicy'
  | 'notConfiguredForUser'
  | 'retriesExhausted'
  | 'canceled'
  | 'unknown';

type AsyncError = 'canceled' | 'error' | Error;

export type HourCyclePreference = '12' | '24' | 'unknown';

type BindingType = Readonly<{
  getHourCyclePreference(): HourCyclePreference;
  checkAvailability(
    callback: (result: Availability | AsyncError) => void,
  ): void;
  requestVerification(
    message: string,
    callback: (result: Verification | AsyncError) => void,
  ): void;
}>;

let binding: BindingType | undefined;
if (process.platform === 'win32') {
  binding = loadBinding('windows-ucv');
}

/** Read the hour cycle from the user's Windows short-time format. */
export function getHourCyclePreference(): HourCyclePreference {
  if (!binding) {
    throw new Error('This library works only on Windows');
  }
  return binding.getHourCyclePreference();
}

/**
 * Check if User Constant Verification is available.
 *
 * See: https://learn.microsoft.com/en-us/uwp/api/windows.security.credentials.ui.userconsentverifier.checkavailabilityasync?view=winrt-26100#windows-security-credentials-ui-userconsentverifier-checkavailabilityasync
 */
export async function checkAvailability(): Promise<Availability> {
  if (!binding) {
    throw new Error('This library works only on Windows');
  }
  return new Promise((resolve, reject) => {
    binding.checkAvailability((result) => {
      if (result === 'canceled') {
        return reject(new Error('Canceled'));
      }
      if (result === 'error') {
        return reject(new Error('Internal error'));
      }
      if (result instanceof Error) {
        return reject(result);
      }

      return resolve(result);
    });
  });
}

/**
 * Request User Constant Verification
 *
 * See: https://learn.microsoft.com/en-us/uwp/api/windows.security.credentials.ui.userconsentverifier.requestverificationasync?view=winrt-26100
 */
export async function requestVerification(
  message: string,
): Promise<Verification> {
  if (!binding) {
    throw new Error('This library works only on Windows');
  }
  return new Promise((resolve, reject) => {
    binding.requestVerification(message, (result) => {
      if (result === 'canceled') {
        return reject(new Error('Canceled'));
      }
      if (result === 'error') {
        return reject(new Error('Internal error'));
      }
      if (result instanceof Error) {
        return reject(result);
      }

      return resolve(result);
    });
  });
}
