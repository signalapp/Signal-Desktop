// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationType } from '../state/ducks/conversations';
import { isAciString } from '../types/ServiceId';

export const isSafetyNumberNotAvailable = (
  contact?: ConversationType
): boolean => {
  // We have a contact
  if (!contact) {
    return true;
  }

  return !isAciString(contact.serviceId);
};
