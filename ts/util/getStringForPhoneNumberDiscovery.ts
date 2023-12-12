// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LocalizerType } from '../types/Util';

export function getStringForPhoneNumberDiscovery({
  phoneNumber,
  i18n,
  conversationTitle,
  sharedGroup,
}: {
  phoneNumber: string;
  i18n: LocalizerType;
  conversationTitle: string;
  sharedGroup?: string;
}): string {
  if (sharedGroup) {
    return i18n('icu:PhoneNumberDiscovery--notification--withSharedGroup', {
      phoneNumber,
      conversationTitle,
      sharedGroup,
    });
  }

  return i18n('icu:PhoneNumberDiscovery--notification--noSharedGroup', {
    phoneNumber,
    conversationTitle,
  });
}
