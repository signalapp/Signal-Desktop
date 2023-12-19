// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNotNil } from '../../util/isNotNil';
import * as log from '../../logging/log';
import type { ServiceIdString } from '../../types/ServiceId';

export function getUntrustedConversationServiceIds(
  recipients: ReadonlyArray<string>
): Array<ServiceIdString> {
  return recipients
    .map(recipient => {
      const recipientConversation = window.ConversationController.getOrCreate(
        recipient,
        'private'
      );

      if (!recipientConversation.isUntrusted()) {
        return null;
      }

      const serviceId = recipientConversation.getServiceId();
      if (!serviceId) {
        log.warn(
          `getUntrustedConversationServiceIds: Conversation ${recipientConversation.idForLogging()} had no serviceId`
        );
        return null;
      }

      return serviceId;
    })
    .filter(isNotNil);
}
