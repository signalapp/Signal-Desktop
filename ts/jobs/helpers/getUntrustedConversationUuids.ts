// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNotNil } from '../../util/isNotNil';
import * as log from '../../logging/log';

export function getUntrustedConversationUuids(
  recipients: ReadonlyArray<string>
): Array<string> {
  return recipients
    .map(recipient => {
      const recipientConversation = window.ConversationController.getOrCreate(
        recipient,
        'private'
      );

      if (!recipientConversation.isUntrusted()) {
        return null;
      }

      const uuid = recipientConversation.get('uuid');
      if (!uuid) {
        log.warn(
          `getUntrustedConversationUuids: Conversation ${recipientConversation.idForLogging()} had no UUID`
        );
        return null;
      }

      return uuid;
    })
    .filter(isNotNil);
}
