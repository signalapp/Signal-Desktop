// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import { getOwn } from '../util/getOwn.std.js';
import { map, concat, repeat, zipObject } from '../util/iterables.std.js';
import { isOutgoing } from '../state/selectors/message.preload.js';
import type { MessageAttributesType } from '../model-types.d.ts';
import type {
  SendState,
  SendStateByConversationId,
} from './MessageSendState.std.js';
import {
  SendActionType,
  sendStateReducer,
  SendStatus,
} from './MessageSendState.std.js';

const { get, isEmpty } = lodash;

type LegacyCustomError = Error & {
  identifier?: string;
  number?: string;
};

/**
 * This converts legacy message fields, such as `sent_to`, into the new
 * `sendStateByConversationId` format. These legacy fields aren't typed to prevent their
 * usage, so we treat them carefully (i.e., as if they are `unknown`).
 *
 * Old data isn't dropped, in case we need to revert this change. We should safely be able
 * to remove the following attributes once we're confident in this new format:
 *
 * - delivered
 * - delivered_to
 * - read_by
 * - recipients
 * - sent
 * - sent_to
 */
export function migrateLegacySendAttributes(
  message: Readonly<
    Pick<
      MessageAttributesType,
      'errors' | 'sendStateByConversationId' | 'sent_at' | 'type'
    >
  >,
  getConversation: GetConversationType,
  ourConversationId: string
): undefined | SendStateByConversationId {
  const shouldMigrate =
    isEmpty(message.sendStateByConversationId) && isOutgoing(message);
  if (!shouldMigrate) {
    return undefined;
  }

  const pendingSendState: SendState = {
    status: SendStatus.Pending,
    updatedAt: message.sent_at,
  };

  const sendStateByConversationId: SendStateByConversationId = zipObject(
    getConversationIdsFromLegacyAttribute(
      message,
      'recipients',
      getConversation
    ),
    repeat(pendingSendState)
  );

  // We use `get` because `sent` is a legacy, and therefore untyped, attribute.
  const wasSentToSelf = Boolean(get(message, 'sent'));

  const actions = concat<{
    type:
      | SendActionType.Failed
      | SendActionType.Sent
      | SendActionType.GotDeliveryReceipt
      | SendActionType.GotReadReceipt;
    conversationId: string;
  }>(
    map(
      getConversationIdsFromErrors(message.errors, getConversation),
      conversationId => ({
        type: SendActionType.Failed,
        conversationId,
      })
    ),
    map(
      getConversationIdsFromLegacyAttribute(
        message,
        'sent_to',
        getConversation
      ),
      conversationId => ({
        type: SendActionType.Sent,
        conversationId,
      })
    ),
    map(
      getConversationIdsFromLegacyAttribute(
        message,
        'delivered_to',
        getConversation
      ),
      conversationId => ({
        type: SendActionType.GotDeliveryReceipt,
        conversationId,
      })
    ),
    map(
      getConversationIdsFromLegacyAttribute(
        message,
        'read_by',
        getConversation
      ),
      conversationId => ({
        type: SendActionType.GotReadReceipt,
        conversationId,
      })
    ),
    [
      {
        type: wasSentToSelf ? SendActionType.Sent : SendActionType.Failed,
        conversationId: ourConversationId,
      },
    ]
  );

  for (const { conversationId, type } of actions) {
    const oldSendState =
      getOwn(sendStateByConversationId, conversationId) || pendingSendState;
    sendStateByConversationId[conversationId] = sendStateReducer(oldSendState, {
      type,
      updatedAt: undefined,
    });
  }

  return sendStateByConversationId;
}

function getConversationIdsFromErrors(
  errors: undefined | ReadonlyArray<LegacyCustomError>,
  getConversation: GetConversationType
): Array<string> {
  const result: Array<string> = [];
  (errors || []).forEach(error => {
    const conversation =
      getConversation(error.identifier) || getConversation(error.number);
    if (conversation) {
      result.push(conversation.id);
    }
  });
  return result;
}

function getConversationIdsFromLegacyAttribute(
  message: Record<string, unknown>,
  attributeName: string,
  getConversation: GetConversationType
): Array<string> {
  const rawValue: unknown =
    message[attributeName as keyof MessageAttributesType];
  const value: Array<unknown> = Array.isArray(rawValue) ? rawValue : [];

  const result: Array<string> = [];
  value.forEach(identifier => {
    if (typeof identifier !== 'string') {
      return;
    }
    const conversation = getConversation(identifier);
    if (conversation) {
      result.push(conversation.id);
    }
  });
  return result;
}

type GetConversationType = (id?: string | null) => { id: string } | undefined;
