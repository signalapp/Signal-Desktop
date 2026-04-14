// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue.preload.ts';
import { MessageSender } from './SendMessage.preload.ts';
import { toLogFormat } from '../types/errors.std.ts';

const log = createLogger('syncRequests');

export async function sendSyncRequests(): Promise<void> {
  if (window.ConversationController.areWePrimaryDevice()) {
    throw new Error(
      'sendSyncRequests: Cannot send sync requests if we are primary device'
    );
  }

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
