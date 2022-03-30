// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNotNil } from '../../util/isNotNil';

export function getUntrustedConversationIds(
  recipients: ReadonlyArray<string>
): Array<string> {
  return recipients
    .map(recipient => {
      const recipientConversation = window.ConversationController.getOrCreate(
        recipient,
        'private'
      );
      return recipientConversation.isUntrusted()
        ? recipientConversation.id
        : null;
    })
    .filter(isNotNil);
}
