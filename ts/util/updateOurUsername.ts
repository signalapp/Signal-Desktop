// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export async function updateOurUsername(): Promise<void> {
  if (!window.textsecure.messaging) {
    throw new Error(
      'updateOurUsername: window.textsecure.messaging not available'
    );
  }

  const me = window.ConversationController.getOurConversationOrThrow();
  const { username } = await window.textsecure.messaging.whoami();

  me.set({ username });
  window.Signal.Data.updateConversation(me.attributes);
}
