// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import dataInterface from '../sql/Client';
import { handleMessageSend } from '../util/handleMessageSend';
import { updateOurUsername } from '../util/updateOurUsername';

export async function writeUsername({
  username,
  previousUsername,
}: {
  username: string | undefined;
  previousUsername: string | undefined;
}): Promise<void> {
  const me = window.ConversationController.getOurConversationOrThrow();
  await updateOurUsername();

  if (me.get('username') !== previousUsername) {
    throw new Error('Username has changed on another device');
  }

  if (username) {
    await window.textsecure.messaging.putUsername(username);
  } else {
    await window.textsecure.messaging.deleteUsername();
  }

  // Update backbone, update DB, then tell linked devices about profile update
  me.set({
    username,
  });

  dataInterface.updateConversation(me.attributes);

  await handleMessageSend(
    window.textsecure.messaging.sendFetchLocalProfileSyncMessage(),
    { messageIds: [], sendType: 'otherSync' }
  );
}
