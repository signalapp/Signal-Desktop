// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { makeEnumParser } from './enum.std.js';

// These strings are saved to disk, so be careful when changing them.
export enum PhoneNumberDiscoverability {
  Discoverable = 'Discoverable',
  NotDiscoverable = 'NotDiscoverable',
}

export const parsePhoneNumberDiscoverability = makeEnumParser(
  PhoneNumberDiscoverability,
  PhoneNumberDiscoverability.Discoverable
);
