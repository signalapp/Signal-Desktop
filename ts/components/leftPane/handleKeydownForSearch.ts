// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as KeyboardLayout from '../../services/keyboardLayout.dom.js';

export function handleKeydownForSearch(
  event: Readonly<KeyboardEvent>,
  {
    searchInConversation,
    selectedConversationId,
    startSearch,
  }: Readonly<{
    searchInConversation: (conversationId: string) => unknown;
    selectedConversationId: undefined | string;
    startSearch: () => unknown;
  }>
): void {
  const { ctrlKey, metaKey, shiftKey } = event;
  const commandKey = window.platform === 'darwin' && metaKey;
  const controlKey = window.platform !== 'darwin' && ctrlKey;
  const commandOrCtrl = commandKey || controlKey;
  const commandAndCtrl = commandKey && ctrlKey;
  const key = KeyboardLayout.lookup(event);

  if (commandOrCtrl && !commandAndCtrl && (key === 'f' || key === 'F')) {
    if (!shiftKey) {
      startSearch();
      event.preventDefault();
      event.stopPropagation();
    } else if (selectedConversationId) {
      searchInConversation(selectedConversationId);
      event.preventDefault();
      event.stopPropagation();
    }
  }
}
