// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function reloadSelectedConversation(): void {
  const { conversations } = window.reduxStore.getState();
  const { selectedConversationId } = conversations;
  if (!selectedConversationId) {
    return;
  }
  const conversation = window.ConversationController.get(
    selectedConversationId
  );
  if (!conversation) {
    return;
  }
  conversation.cachedProps = undefined;
  window.reduxActions.conversations.conversationsUpdated([
    conversation.format(),
  ]);
}
