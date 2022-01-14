// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue';
import dataInterface from '../sql/Client';
import { updateOurUsername } from '../util/updateOurUsername';
import * as Errors from '../types/errors';
import * as log from '../logging/log';

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

  try {
    await singleProtoJobQueue.add(
      window.textsecure.messaging.getFetchLocalProfileSyncMessage()
    );
  } catch (error) {
    log.error(
      'writeUsername: Failed to queue sync message',
      Errors.toLogFormat(error)
    );
  }
}
