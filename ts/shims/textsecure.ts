// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function sendStickerPackSync(
  packId: string,
  packKey: string,
  installed: boolean
): void {
  const { ConversationController, textsecure, log } = window;
  const ourNumber = textsecure.storage.user.getNumber();
  const { wrap, sendOptions } = ConversationController.prepareForSend(
    ourNumber,
    { syncMessage: true }
  );

  if (!textsecure.messaging) {
    log.error(
      'shim: Cannot call sendStickerPackSync, textsecure.messaging is falsey'
    );

    return;
  }

  wrap(
    textsecure.messaging.sendStickerPackSync(
      [
        {
          packId,
          packKey,
          installed,
        },
      ],
      sendOptions
    )
  ).catch(error => {
    log.error(
      'shim: Error calling sendStickerPackSync:',
      error && error.stack ? error.stack : error
    );
  });
}
