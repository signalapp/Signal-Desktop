// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import memoizee from 'memoizee';
import { instance, PhoneNumberFormat } from '../util/libphonenumberInstance';
import * as log from '../logging/log';
import * as Errors from './errors';

function _format(
  phoneNumber: string,
  options: {
    ourRegionCode?: string;
  }
) {
  try {
    const { ourRegionCode } = options;
    const parsedNumber = instance.parse(phoneNumber);
    const regionCode = instance.getRegionCodeForNumber(parsedNumber);

    if (ourRegionCode && regionCode === ourRegionCode) {
      return instance.format(parsedNumber, PhoneNumberFormat.NATIONAL);
    }

    return instance.format(parsedNumber, PhoneNumberFormat.INTERNATIONAL);
  } catch (error) {
    return phoneNumber;
  }
}

export function getCountryCode(
  phoneNumber: string | undefined
): number | undefined {
  try {
    if (phoneNumber == null) {
      return undefined;
    }
    if (!isValidNumber(phoneNumber)) {
      return undefined;
    }

    return instance.parse(phoneNumber).getCountryCode();
  } catch (error) {
    const errorText = Errors.toLogFormat(error);
    log.info(
      `getCountryCode: Failed to get country code from ${phoneNumber}: ${errorText}`
    );
    return undefined;
  }
}

export function isValidNumber(
  phoneNumber: string,
  options?: {
    regionCode?: string;
  }
): boolean {
  const { regionCode } = options || { regionCode: undefined };
  try {
    const parsedNumber = instance.parse(phoneNumber, regionCode);

    return instance.isValidNumber(parsedNumber);
  } catch (error) {
    return false;
  }
}

export const format = memoizee(_format, {
  primitive: true,
  // Convert the arguments to a unique string, required for primitive mode.
  normalizer: (...args) => JSON.stringify(args),
  max: 5000,
});

export function normalize(
  phoneNumber: string,
  options: { regionCode: string }
): string | undefined {
  const { regionCode } = options;
  try {
    const parsedNumber = instance.parse(phoneNumber, regionCode);

    if (instance.isValidNumber(parsedNumber)) {
      return instance.format(parsedNumber, PhoneNumberFormat.E164);
    }

    return undefined;
  } catch (error) {
    return undefined;
  }
}
