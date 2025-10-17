// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNotNil } from '../../util/isNotNil.std.js';
import { createLogger } from '../../logging/log.std.js';
import type { ServiceIdString } from '../../types/ServiceId.std.js';

const log = createLogger('getUntrustedConversationServiceIds');

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
          `Conversation ${recipientConversation.idForLogging()} had no serviceId`
        );
        return null;
      }

      return serviceId;
    })
    .filter(isNotNil);
}
