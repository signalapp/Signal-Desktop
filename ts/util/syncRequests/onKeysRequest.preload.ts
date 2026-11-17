// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../../logging/log.std.ts';
import { singleProtoJobQueue } from '../../jobs/singleProtoJobQueue.preload.ts';
import { MessageSender } from '../../textsecure/SendMessage.preload.ts';
import { toLogFormat } from '../../types/errors.std.ts';

import type { KeysRequestEvent } from '../../textsecure/messageReceiverEvents.std.ts';

const log = createLogger('onKeysRequest');

export async function onKeysRequest(event: KeysRequestEvent): Promise<void> {
  const logId = `${event.sentAt}`;

  try {
    log.info(`${logId}: Sending response to keys request`);
    await singleProtoJobQueue.add(MessageSender.getKeysSyncMessage());
    event.confirm();
  } catch (error) {
    log.error(`${logId}: Failed to respond`, toLogFormat(error));
  }
}
