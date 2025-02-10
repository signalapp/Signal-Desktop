// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString } from '../types/ServiceId';
import type { ConversationModel } from '../models/conversations';
import * as Errors from '../types/errors';
import * as log from '../logging/log';
import { drop } from '../util/drop';
import { getConversationIdForLogging } from '../util/idForLogging';

export type MessageRequestAttributesType = {
  envelopeId: string;
  groupV2Id?: string;
  removeFromMessageReceiverCache: () => unknown;
  threadAci?: AciString;
  type: number;
};

const messageRequests = new Map<string, MessageRequestAttributesType>();

function remove(sync: MessageRequestAttributesType): void {
  messageRequests.delete(sync.envelopeId);
  sync.removeFromMessageReceiverCache();
}

export function forConversation(
  conversation: ConversationModel
): MessageRequestAttributesType | null {
  const logId = `MessageRequests.forConversation(${getConversationIdForLogging(
    conversation.attributes
  )})`;

  const messageRequestValues = Array.from(messageRequests.values());

  if (conversation.getServiceId()) {
    const syncByServiceId = messageRequestValues.find(
      item => item.threadAci === conversation.getServiceId()
    );
    if (syncByServiceId) {
      log.info(`${logId}: Found early message request response for serviceId`);
      remove(syncByServiceId);
      return syncByServiceId;
    }
  }

  // V2 group
  if (conversation.get('groupId')) {
    const syncByGroupId = messageRequestValues.find(
      item => item.groupV2Id === conversation.get('groupId')
    );
    if (syncByGroupId) {
      log.info(`${logId}: Found early message request response for gv2`);
      remove(syncByGroupId);
      return syncByGroupId;
    }
  }

  return null;
}

export async function onResponse(
  sync: MessageRequestAttributesType
): Promise<void> {
  messageRequests.set(sync.envelopeId, sync);
  const { threadAci, groupV2Id } = sync;

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
        fromSync: true,
      })
    );

    remove(sync);
  } catch (error) {
    remove(sync);
    log.error(`${logId} error:`, Errors.toLogFormat(error));
  }
}
