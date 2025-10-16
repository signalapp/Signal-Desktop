// Copyright 2014 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  instance as libphonenumber,
  PhoneNumberFormat,
} from './libphonenumberInstance.std.js';

const FALLBACK_REGION_CODE = 'ZZ';

export function getRegionCodeForNumber(number: string): string {
  try {
    const parsedNumber = libphonenumber.parse(number);
    return (
      libphonenumber.getRegionCodeForNumber(parsedNumber) ||
      FALLBACK_REGION_CODE
    );
  } catch (e) {
    return FALLBACK_REGION_CODE;
  }
}

export function parseNumber(
  number: string,
  defaultRegionCode?: string
):
  | { isValidNumber: false; error: unknown }
  | {
      isValidNumber: true;
      regionCode: undefined | string;
      countryCode: undefined | string;
      e164: string;
    } {
  try {
    const parsedNumber = libphonenumber.parse(number, defaultRegionCode);

    const isValidNumber = libphonenumber.isValidNumber(parsedNumber);
    if (!isValidNumber) {
      return { error: new Error('Invalid phone number'), isValidNumber: false };
    }

    return {
      isValidNumber: true,
      regionCode: libphonenumber.getRegionCodeForNumber(parsedNumber),
      countryCode: parsedNumber.getCountryCode()?.toString(),
      e164: libphonenumber.format(parsedNumber, PhoneNumberFormat.E164),
    };
  } catch (error) {
    return { error, isValidNumber: false };
  }
}
