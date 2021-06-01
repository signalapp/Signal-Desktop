// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type MinimalConversationType = Readonly<{
  type?: string;
  e164?: string;
  uuid?: string;
  discoveredUnregisteredAt?: number;
}>;

export function isConversationSMSOnly(
  conversation: MinimalConversationType
): boolean {
  const { e164, uuid, type } = conversation;
  // `direct` for redux, `private` for models and the database
  if (type !== 'direct' && type !== 'private') {
    return false;
  }

  if (e164 && !uuid) {
    return true;
  }

  return conversation.discoveredUnregisteredAt !== undefined;
}
