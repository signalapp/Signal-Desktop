// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationType } from '../state/ducks/conversations';

export const isSafetyNumberNotAvailable = (
  contact?: ConversationType
): boolean => {
  // We have a contact
  if (!contact) {
    return true;
  }
  // They have a uuid
  if (!contact.uuid) {
    return true;
  }
  // The uuid is not PNI
  return contact.pni === contact.uuid;
};
