// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function getUntrustedConversationIds(
  recipients: ReadonlyArray<string>
): Array<string> {
  return recipients.filter(recipient => {
    const recipientConversation = window.ConversationController.getOrCreate(
      recipient,
      'private'
    );
    return recipientConversation.isUntrusted();
  });
}
