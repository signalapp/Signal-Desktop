// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { toBase64 } from '../Bytes.std.ts';
import { strictAssert } from './assert.std.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import { PhoneNumberDiscoverability } from './phoneNumberDiscoverability.std.ts';
import { deriveAccessKeyFromProfileKey } from './zkgroup.node.ts';
import { getRegistrationLockString } from './getRegistrationLockString.preload.ts';
import { getRecoveryPassword } from './getRecoveryPassword.preload.ts';
import { getCapabilities } from './getCapabilities.std.ts';

import type { AccountAttributesJSON } from '../textsecure/WebAPI.preload.ts';
import type { CapabilitiesUploadType } from '../types/Capabilities.d.ts';

export function assembleAccountAttributes(): AccountAttributesJSON {
  if (!window.ConversationController.areWePrimaryDevice()) {
    throw new Error(
      'We can only upload account attributes if we are a primary device!'
    );
  }

  const capabilities: CapabilitiesUploadType = getCapabilities({
    optionalPhoneNumber: itemStorage.user.getOptionalNumber() == null,
  });

  const ourAci = itemStorage.user.getCheckedAci();
  const ourPni = itemStorage.user.getOptionalPni();
  const registrationIdMap = itemStorage.get('registrationIdMap') || {};
  const registrationId = registrationIdMap[ourAci];
  strictAssert(
    registrationId,
    'assembleAccountAttributes must have our own registrationId!'
  );
  const pniRegistrationId = ourPni ? (registrationIdMap[ourPni] ?? null) : null;

  const registrationLock = itemStorage.get('registrationLock')
    ? getRegistrationLockString()
    : null;

  const profileKey = itemStorage.get('profileKey');
  strictAssert(
    profileKey,
    'assembleAccountAttributes must have our own profileKey!'
  );
  const unidentifiedAccessKey = toBase64(
    deriveAccessKeyFromProfileKey(profileKey)
  );

  // Desktop doesn't currently support this setting, so default it to false
  const unrestrictedUnidentifiedAccess = false;

  const phoneNumberDiscoverability = itemStorage.get(
    'phoneNumberDiscoverability',
    PhoneNumberDiscoverability.Discoverable
  );
  const discoverableByPhoneNumber =
    phoneNumberDiscoverability === PhoneNumberDiscoverability.Discoverable;

  const recoveryPasswordData = getRecoveryPassword();
  const recoveryPassword = toBase64(recoveryPasswordData);

  return {
    // Per-device
    fetchesMessages: true,
    capabilities,
    name: null,
    // Per-account
    registrationId,
    pniRegistrationId,
    registrationLock,
    unidentifiedAccessKey,
    unrestrictedUnidentifiedAccess,
    discoverableByPhoneNumber,
    recoveryPassword,
  };
}
