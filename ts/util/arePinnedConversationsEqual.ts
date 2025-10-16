// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as Bytes from '../Bytes.std.js';

import { SignalService as Proto } from '../protobuf/index.std.js';
import { fromServiceIdBinaryOrString } from './ServiceId.node.js';

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
        const { contact: remoteContact } = remotePinnedConversation;
        if (!remoteContact) {
          return false;
        }

        const serviceId = fromServiceIdBinaryOrString(
          contact.serviceIdBinary,
          contact.serviceId,
          `arePinnedConversationsEqual(${index}).local`
        );

        const remoteServiceId = fromServiceIdBinaryOrString(
          remoteContact.serviceIdBinary,
          remoteContact.serviceId,
          `arePinnedConversationsEqual(${index}).remote`
        );

        return serviceId === remoteServiceId;
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
