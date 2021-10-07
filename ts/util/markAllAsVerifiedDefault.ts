// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationModel } from '../models/conversations';

export async function markAllAsVerifiedDefault(
  unverified: ReadonlyArray<ConversationModel>
): Promise<void> {
  await Promise.all(
    unverified.map(contact => {
      if (contact.isUnverified()) {
        return contact.setVerifiedDefault();
      }

      return null;
    })
  );
}
