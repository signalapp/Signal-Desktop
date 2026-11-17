// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../../logging/log.std.ts';
import { toLogFormat } from '../../types/errors.std.ts';
import { singleProtoJobQueue } from '../../jobs/singleProtoJobQueue.preload.ts';
import { MessageSender } from '../../textsecure/SendMessage.preload.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';

import type { BlockSyncRequestEvent } from '../../textsecure/messageReceiverEvents.std.ts';

const log = createLogger('onBlockSyncRequest');

export async function onBlockSyncRequest(
  event: BlockSyncRequestEvent
): Promise<void> {
  const logId = `${event.sentAt}`;

  try {
    log.info(`${logId}: Sending response to block sync request`);
    await singleProtoJobQueue.add(
      MessageSender.getBlockSync(itemStorage.blocked.getBlockedData())
    );
    event.confirm();
  } catch (error) {
    log.error(`${logId}: Failed to respond`, toLogFormat(error));
  }
}
