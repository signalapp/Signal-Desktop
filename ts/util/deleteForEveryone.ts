// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DeletesModelType } from '../model-types.d';
import { MessageModel } from '../models/messages';

const ONE_DAY = 24 * 60 * 60 * 1000;

export async function deleteForEveryone(
  message: MessageModel,
  doe: DeletesModelType,
  shouldPersist = true
): Promise<void> {
  // Make sure the server timestamps for the DOE and the matching message
  // are less than one day apart
  const delta = Math.abs(
    doe.get('serverTimestamp') - (message.get('serverTimestamp') || 0)
  );
  if (delta > ONE_DAY) {
    window.log.info('Received late DOE. Dropping.', {
      fromId: doe.get('fromId'),
      targetSentTimestamp: doe.get('targetSentTimestamp'),
      messageServerTimestamp: message.get('serverTimestamp'),
      deleteServerTimestamp: doe.get('serverTimestamp'),
    });
    return;
  }

  await message.handleDeleteForEveryone(doe, shouldPersist);
}
