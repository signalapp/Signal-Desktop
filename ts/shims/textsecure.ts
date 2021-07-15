// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { handleMessageSend } from '../util/handleMessageSend';
import { getSendOptions } from '../util/getSendOptions';

export async function sendStickerPackSync(
  packId: string,
  packKey: string,
  installed: boolean
): Promise<void> {
  const { ConversationController, textsecure, log } = window;
  const ourConversation = ConversationController.getOurConversationOrThrow();
  const sendOptions = await getSendOptions(ourConversation.attributes, {
    syncMessage: true,
  });

  if (!textsecure.messaging) {
    log.error(
      'shim: Cannot call sendStickerPackSync, textsecure.messaging is falsey'
    );

    return;
  }

  if (window.ConversationController.areWePrimaryDevice()) {
    window.log.warn(
      'shims/sendStickerPackSync: We are primary device; not sending sync'
    );
    return;
  }

  handleMessageSend(
    textsecure.messaging.sendStickerPackSync(
      [
        {
          packId,
          packKey,
          installed,
        },
      ],
      sendOptions
    ),
    { messageIds: [], sendType: 'otherSync' }
  ).catch(error => {
    log.error(
      'shim: Error calling sendStickerPackSync:',
      error && error.stack ? error.stack : error
    );
  });
}
