// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString } from '../types/ServiceId.std.ts';
import { getCountryCode } from '../types/PhoneNumber.std.ts';
import { HashType } from '../types/Crypto.std.ts';
import * as Bytes from '../Bytes.std.ts';
import { uuidToBytes } from './uuidToBytes.std.ts';
import { hash } from '../Crypto.node.ts';
import type { ConfigKeyType } from '../RemoteConfig.std.ts';
import { getValue, getCountryCodeValue } from '../RemoteConfig.std.ts';

export function getBucketValue(aci: AciString, hashSalt: string): number {
  const hashInput = Bytes.concatenate([
    Bytes.fromString(`${hashSalt}.`),
    uuidToBytes(aci),
  ]);
  const hashResult = hash(HashType.size256, hashInput);

  return Number(Bytes.readBigUint64BE(hashResult.subarray(0, 8)) % 1_000_000n);
}

export function isCountryPpmCsvBucketEnabled(
  name: string,
  countryPpmCsv: unknown,
  e164: string | undefined,
  aci: AciString | undefined
): boolean {
  if (aci == null) {
    return false;
  }

  const countryCode = getCountryCode(e164);
  if (countryCode == null) {
    return false;
  }

  if (typeof countryPpmCsv !== 'string') {
    return false;
  }

  const remoteConfigValue = getCountryCodeValue(
    countryCode,
    countryPpmCsv,
    name
  );
  if (remoteConfigValue == null) {
    return false;
  }

  const bucketValue = getBucketValue(aci, name);
  return bucketValue < remoteConfigValue;
}

// See isRemoteConfigBucketEnabled in selectors/items.ts
/** @knipignore Keep around for future features that might need it */
export function isBucketValueEnabled(
  name: ConfigKeyType,
  e164: string | undefined,
  aci: AciString | undefined
): boolean {
  return isCountryPpmCsvBucketEnabled(name, getValue(name), e164, aci);
}
