// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue';
import dataInterface from '../sql/Client';
import { updateOurUsernameAndPni } from '../util/updateOurUsernameAndPni';
import * as Errors from '../types/errors';
import * as log from '../logging/log';
import MessageSender from '../textsecure/SendMessage';

export async function writeUsername({
  username,
  previousUsername,
}: {
  username: string | undefined;
  previousUsername: string | undefined;
}): Promise<void> {
  const { messaging } = window.textsecure;
  if (!messaging) {
    throw new Error('messaging interface is not available!');
  }

  const me = window.ConversationController.getOurConversationOrThrow();
  await updateOurUsernameAndPni();

  if (me.get('username') !== previousUsername) {
    throw new Error('Username has changed on another device');
  }

  if (username) {
    await messaging.putUsername(username);
  } else {
    await messaging.deleteUsername();
  }

  // Update backbone, update DB, then tell linked devices about profile update
  me.set({
    username,
  });

  dataInterface.updateConversation(me.attributes);

  try {
    await singleProtoJobQueue.add(
      MessageSender.getFetchLocalProfileSyncMessage()
    );
  } catch (error) {
    log.error(
      'writeUsername: Failed to queue sync message',
      Errors.toLogFormat(error)
    );
  }
}
