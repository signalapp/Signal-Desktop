// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as Bytes from '../Bytes';

import { SignalService as Proto } from '../protobuf';

import PinnedConversation = Proto.AccountRecord.IPinnedConversation;

export function arePinnedConversationsEqual(
  localValue: Array<PinnedConversation>,
  remoteValue: Array<PinnedConversation>
): boolean {
  if (localValue.length !== remoteValue.length) {
    return false;
  }
  return localValue.every(
    (localPinnedConversation: PinnedConversation, index: number) => {
      const remotePinnedConversation = remoteValue[index];

      const { contact, groupMasterKey, legacyGroupId } =
        localPinnedConversation;

      if (contact) {
        return (
          remotePinnedConversation.contact &&
          contact.uuid === remotePinnedConversation.contact.uuid
        );
      }

      if (groupMasterKey && groupMasterKey.length) {
        return Bytes.areEqual(
          groupMasterKey,
          remotePinnedConversation.groupMasterKey
        );
      }

      if (legacyGroupId && legacyGroupId.length) {
        return Bytes.areEqual(
          legacyGroupId,
          remotePinnedConversation.legacyGroupId
        );
      }

      return false;
    }
  );
}
