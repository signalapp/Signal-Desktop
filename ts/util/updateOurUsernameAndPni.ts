// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { strictAssert } from './assert';
import { dropNull } from './dropNull';

export async function updateOurUsernameAndPni(): Promise<void> {
  const { server } = window.textsecure;

  strictAssert(
    server,
    'updateOurUsernameAndPni: window.textsecure.server not available'
  );

  const me = window.ConversationController.getOurConversationOrThrow();
  const { username } = await server.whoami();

  me.set({ username: dropNull(username) });
  window.Signal.Data.updateConversation(me.attributes);

  const manager = window.getAccountManager();
  strictAssert(
    manager,
    'updateOurUsernameAndPni: AccountManager not available'
  );
}
