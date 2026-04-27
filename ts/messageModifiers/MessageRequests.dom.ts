// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString } from '../types/ServiceId.std.ts';
import * as Errors from '../types/errors.std.ts';
import { createLogger } from '../logging/log.std.ts';
import { drop } from '../util/drop.std.ts';
import type { MessageRequestResponseSource } from '../types/MessageRequestResponseEvent.std.ts';

const log = createLogger('MessageRequests');

export type MessageRequestAttributesType = {
  envelopeId: string;
  groupV2Id?: string;
  removeFromMessageReceiverCache: () => unknown;
  receivedAtMs: number;
  receivedAtCounter: number;
  sourceType:
    | MessageRequestResponseSource.BLOCK_SYNC
    | MessageRequestResponseSource.MRR_SYNC;
  sentAt: number;
  threadAci?: AciString;
  type: number;
};

const messageRequests = new Map<string, MessageRequestAttributesType>();

function remove(sync: MessageRequestAttributesType): void {
  messageRequests.delete(sync.envelopeId);
  sync.removeFromMessageReceiverCache();
}

export async function onResponse(
  sync: MessageRequestAttributesType
): Promise<void> {
  messageRequests.set(sync.envelopeId, sync);
  const {
    threadAci,
    groupV2Id,
    receivedAtMs,
    sentAt,
    receivedAtCounter,
    sourceType,
  } = sync;

  const logId = `MessageRequests.onResponse(groupv2(${groupV2Id}) ${threadAci}`;

  try {
    let conversation;

    // We multiplex between GV1/GV2 groups here, but we don't kick off migrations
    if (groupV2Id) {
      conversation = window.ConversationController.get(groupV2Id);
    }
    if (!conversation && threadAci) {
      conversation = window.ConversationController.lookupOrCreate({
        serviceId: threadAci,
        reason: logId,
      });
    }

    if (!conversation) {
      log.warn(
        `${logId}: received message request response for unknown conversation`
      );
      remove(sync);
      return;
    }

    drop(
      conversation.applyMessageRequestResponse(sync.type, {
        source: sourceType,
        receivedAtCounter,
        receivedAtMs,
        timestamp: sentAt,
      })
    );

    remove(sync);
  } catch (error) {
    remove(sync);
    log.error(`${logId} error:`, Errors.toLogFormat(error));
  }
}
