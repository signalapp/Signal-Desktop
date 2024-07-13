// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import memoizee from 'memoizee';

import { instance } from './libphonenumberInstance';

export type CountryDataType = Readonly<{
  region: string;
  displayName: string;
  code: string;
}>;

// See https://github.com/signalapp/Signal-iOS-Private/blob/e788a20db08d724eb3013f49b84b06da6d8c7b5c/SignalServiceKit/src/Contacts/PhoneNumberUtil.swift#L22-L70
function getCountryCodeForRegion(region: string): string {
  let code: number;
  if (region === 'AQ') {
    // Antarctica
    code = 672;
  } else if (region === 'BV') {
    // Bouvet Island
    code = 55;
  } else if (region === 'IC') {
    // Canary Islands
    code = 34;
  } else if (region === 'EA') {
    // Ceuta & Melilla
    code = 34;
  } else if (region === 'CP') {
    // Clipperton Island
    //
    // This country code should be filtered - it does not appear to have a calling code.
    throw new Error(`Unsupported country region: ${region}`);
  } else if (region === 'DG') {
    // Diego Garcia
    code = 246;
  } else if (region === 'TF') {
    // French Southern Territories
    code = 262;
  } else if (region === 'HM') {
    // Heard & McDonald Islands
    code = 672;
  } else if (region === 'XK') {
    // Kosovo
    code = 383;
  } else if (region === 'PN') {
    // Pitcairn Islands
    code = 64;
  } else if (region === 'GS') {
    // So. Georgia & So. Sandwich Isl.
    code = 500;
  } else if (region === 'UM') {
    // U.S. Outlying Islands
    code = 1;
  } else {
    code = instance.getCountryCodeForRegion(region);
    if (code == null) {
      throw new Error(`Unsupported country region: ${region}`);
    }
  }

  return `+${code}`;
}

function computeCountryDataForLocale(
  locale: string
): ReadonlyArray<CountryDataType> {
  const map = window.SignalContext.getCountryDisplayNames()[locale];

  const list = Object.entries(map).map(([region, displayName]) => {
    return {
      region,
      displayName,
      code: getCountryCodeForRegion(region),
    };
  });

  list.sort((a, b) => {
    if (a.displayName === b.displayName) {
      return 0;
    }

    return a.displayName < b.displayName ? -1 : 1;
  });

  return list;
}

export const getCountryDataForLocale = memoizee(computeCountryDataForLocale);
