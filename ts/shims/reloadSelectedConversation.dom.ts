// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getSelectedConversationId } from '../state/selectors/nav.std.js';

export function reloadSelectedConversation(): void {
  const selectedConversationId = getSelectedConversationId(
    window.reduxStore.getState()
  );
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
