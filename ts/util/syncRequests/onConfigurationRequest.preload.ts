// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../../logging/log.std.ts';
import { toLogFormat } from '../../types/errors.std.ts';
import { singleProtoJobQueue } from '../../jobs/singleProtoJobQueue.preload.ts';
import { MessageSender } from '../../textsecure/SendMessage.preload.ts';

import type { ConfigurationRequestEvent } from '../../textsecure/messageReceiverEvents.std.ts';

const log = createLogger('onConfigurationRequest');

export async function onConfigurationRequest(
  event: ConfigurationRequestEvent
): Promise<void> {
  const logId = `${event.sentAt}`;

  try {
    log.info(`${logId}: Sending response to configuration request`);
    await singleProtoJobQueue.add(MessageSender.getConfigurationSyncMessage());
    event.confirm();
  } catch (error) {
    log.error(`${logId}: Failed to respond`, toLogFormat(error));
  }
}
