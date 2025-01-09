// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { mapValues, pick } from 'lodash';

import type { CustomError } from '../../textsecure/Types';

import type { MessageAttributesType } from '../../model-types';
import * as log from '../../logging/log';
import * as Errors from '../../types/errors';
import {
  getChangesForPropAtTimestamp,
  getPropForTimestamp,
} from '../../util/editHelpers';
import {
  isSent,
  SendActionType,
  sendStateReducer,
  someRecipientSendStatus,
} from '../../messages/MessageSendState';
import { isStory } from '../../messages/helpers';
import {
  notificationService,
  NotificationType,
} from '../../services/notifications';
import type { MessageModel } from '../../models/messages';

export async function saveErrorsOnMessage(
  message: MessageModel,
  providedErrors: Error | Array<Error>,
  options: { skipSave?: boolean } = {}
): Promise<void> {
  const { skipSave } = options;

  let errors: Array<CustomError>;

  if (!(providedErrors instanceof Array)) {
    errors = [providedErrors];
  } else {
    errors = providedErrors;
  }

  errors.forEach(e => {
    log.error('Message.saveErrors:', Errors.toLogFormat(e));
  });
  errors = errors.map(e => {
    // Note: in our environment, instanceof can be scary, so we have a backup check
    //   (Node.js vs Browser context).
    // We check instanceof second because typescript believes that anything that comes
    //   through here must be an instance of Error, so e is 'never' after that check.
    if ((e.message && e.stack) || e instanceof Error) {
      return pick(
        e,
        'name',
        'message',
        'code',
        'number',
        'identifier',
        'retryAfter',
        'data',
        'reason'
      ) as Required<Error>;
    }
    return e;
  });

  message.set({
    errors: errors.concat(message.get('errors') || []),
  });

  if (!skipSave) {
    await window.MessageCache.saveMessage(message);
  }
}

export function isReplayableError(e: Error): boolean {
  return (
    e.name === 'MessageError' ||
    e.name === 'OutgoingMessageError' ||
    e.name === 'SendMessageNetworkError' ||
    e.name === 'SendMessageChallengeError' ||
    e.name === 'OutgoingIdentityKeyError'
  );
}

/**
 * Change any Pending send state to Failed. Note that this will not mark successful
 * sends failed.
 */
export function markFailed(
  message: MessageModel,
  editMessageTimestamp?: number
): void {
  const now = Date.now();

  const targetTimestamp = editMessageTimestamp || message.get('timestamp');
  const sendStateByConversationId = getPropForTimestamp({
    log,
    message: message.attributes,
    prop: 'sendStateByConversationId',
    targetTimestamp,
  });

  const newSendStateByConversationId = mapValues(
    sendStateByConversationId || {},
    sendState =>
      sendStateReducer(sendState, {
        type: SendActionType.Failed,
        updatedAt: now,
      })
  );

  const updates = getChangesForPropAtTimestamp({
    log,
    message: message.attributes,
    prop: 'sendStateByConversationId',
    targetTimestamp,
    value: newSendStateByConversationId,
  });
  if (updates) {
    message.set(updates);
  }

  notifyStorySendFailed(message);
}

export function notifyStorySendFailed(message: MessageModel): void {
  if (!isStory(message.attributes)) {
    return;
  }

  const { conversationId, id, timestamp } = message.attributes;
  const conversation = window.ConversationController.get(conversationId);

  notificationService.add({
    conversationId,
    storyId: id,
    messageId: id,
    senderTitle: conversation?.getTitle() ?? window.i18n('icu:Stories__mine'),
    message: hasSuccessfulDelivery(message.attributes)
      ? window.i18n('icu:Stories__failed-send--partial')
      : window.i18n('icu:Stories__failed-send--full'),
    isExpiringMessage: false,
    sentAt: timestamp,
    type: NotificationType.Message,
  });
}

function hasSuccessfulDelivery(message: MessageAttributesType): boolean {
  const { sendStateByConversationId } = message;
  const ourConversationId =
    window.ConversationController.getOurConversationIdOrThrow();

  return someRecipientSendStatus(
    sendStateByConversationId ?? {},
    ourConversationId,
    isSent
  );
}
