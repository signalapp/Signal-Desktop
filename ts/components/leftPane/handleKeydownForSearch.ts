// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

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
  const { ctrlKey, metaKey, shiftKey, key } = event;
  const commandKey = window.platform === 'darwin' && metaKey;
  const controlKey = window.platform !== 'darwin' && ctrlKey;
  const commandOrCtrl = commandKey || controlKey;
  const commandAndCtrl = commandKey && ctrlKey;

  if (commandOrCtrl && !commandAndCtrl && key.toLowerCase() === 'f') {
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
