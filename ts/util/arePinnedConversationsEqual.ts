// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { arrayBufferToBase64 } from '../Crypto';
import { PinnedConversationClass } from '../textsecure.d';

export function arePinnedConversationsEqual(
  localValue: Array<PinnedConversationClass>,
  remoteValue: Array<PinnedConversationClass>
): boolean {
  if (localValue.length !== remoteValue.length) {
    return false;
  }
  return localValue.every(
    (localPinnedConversation: PinnedConversationClass, index: number) => {
      const remotePinnedConversation = remoteValue[index];
      if (
        localPinnedConversation.identifier !==
        remotePinnedConversation.identifier
      ) {
        return false;
      }
      switch (localPinnedConversation.identifier) {
        case 'contact':
          return (
            localPinnedConversation.contact &&
            remotePinnedConversation.contact &&
            localPinnedConversation.contact.uuid ===
              remotePinnedConversation.contact.uuid
          );
        case 'groupMasterKey':
          return (
            arrayBufferToBase64(localPinnedConversation.groupMasterKey) ===
            arrayBufferToBase64(remotePinnedConversation.groupMasterKey)
          );
        case 'legacyGroupId':
          return (
            arrayBufferToBase64(localPinnedConversation.legacyGroupId) ===
            arrayBufferToBase64(remotePinnedConversation.legacyGroupId)
          );
        default:
          return false;
      }
    }
  );
}
