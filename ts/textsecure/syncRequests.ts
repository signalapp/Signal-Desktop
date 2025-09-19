// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.js';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue.js';
import MessageSender from './SendMessage.js';
import { toLogFormat } from '../types/errors.js';

const log = createLogger('syncRequests');

export async function sendSyncRequests(): Promise<void> {
  log.info('sendSyncRequests: sending sync requests');
  try {
    await Promise.all([
      singleProtoJobQueue.add(MessageSender.getRequestContactSyncMessage()),
      singleProtoJobQueue.add(
        MessageSender.getRequestConfigurationSyncMessage()
      ),
      singleProtoJobQueue.add(MessageSender.getRequestBlockSyncMessage()),
    ]);
  } catch (error: unknown) {
    log.error(
      'sendSyncRequests: failed to send sync requests',
      toLogFormat(error)
    );
    throw error;
  }
}
