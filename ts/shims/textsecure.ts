// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.js';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue.js';
import * as Errors from '../types/errors.js';
import { MessageSender } from '../textsecure/SendMessage.js';

const log = createLogger('textsecure');

export async function sendStickerPackSync(
  packId: string,
  packKey: string,
  installed: boolean
): Promise<void> {
  if (window.ConversationController.areWePrimaryDevice()) {
    log.warn(
      'shims/sendStickerPackSync: We are primary device; not sending sync'
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
