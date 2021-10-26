// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { DeleteModel } from '../messageModifiers/Deletes';
import type { MessageModel } from '../models/messages';
import * as log from '../logging/log';

const ONE_DAY = 24 * 60 * 60 * 1000;

export async function deleteForEveryone(
  message: MessageModel,
  doe: DeleteModel,
  shouldPersist = true
): Promise<void> {
  const messageTimestamp =
    message.get('serverTimestamp') || message.get('sent_at') || 0;

  // Make sure the server timestamps for the DOE and the matching message
  // are less than one day apart
  const delta = Math.abs(doe.get('serverTimestamp') - messageTimestamp);

  if (delta > ONE_DAY) {
    log.info('Received late DOE. Dropping.', {
      fromId: doe.get('fromId'),
      targetSentTimestamp: doe.get('targetSentTimestamp'),
      messageServerTimestamp: message.get('serverTimestamp'),
      messageSentAt: message.get('sent_at'),
      deleteServerTimestamp: doe.get('serverTimestamp'),
    });
    return;
  }

  await message.handleDeleteForEveryone(doe, shouldPersist);
}
