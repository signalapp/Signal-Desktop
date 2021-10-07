// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationModel } from '../models/conversations';

export async function markAllAsApproved(
  untrusted: ReadonlyArray<ConversationModel>
): Promise<void> {
  await Promise.all(untrusted.map(contact => contact.setApproved()));
}
