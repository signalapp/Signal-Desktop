// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue.preload.ts';
import * as Errors from '../types/errors.std.ts';
import { MessageSender } from '../textsecure/SendMessage.preload.ts';

const log = createLogger('textsecure');

export async function sendStickerPackSync(
  packId: string,
  packKey: string,
  installed: boolean
): Promise<void> {
  if (!window.ConversationController.doWeHaveOtherDevices()) {
    log.warn(
      'shims/sendStickerPackSync: We have no other devices; not sending sync'
    );
    return;
  }

  try {
    await singleProtoJobQueue.add(
      MessageSender.getStickerPackSync([
        {
          packId,
          packKey,
          installed,
        },
      ])
    );
  } catch (error) {
    log.error(
      'sendStickerPackSync: Failed to queue sync message',
      Errors.toLogFormat(error)
    );
  }
}
