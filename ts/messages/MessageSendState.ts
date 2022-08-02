// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { makeEnumParser } from '../util/enum';

/**
 * `SendStatus` represents the send status of a message to a single recipient. For
 * example, if a message is sent to 5 people, there would be 5 `SendStatus`es.
 *
 * Under normal conditions, the status will go down this list, in order:
 *
 * 1. `Pending`; the message has not been sent, and we are continuing to try
 * 2. `Sent`; the message has been delivered to the server
 * 3. `Delivered`; we've received a delivery receipt
 * 4. `Read`; we've received a read receipt (not applicable if the recipient has disabled
 *    sending these receipts)
 * 5. `Viewed`; we've received a viewed receipt (not applicable for all message types, or
 *    if the recipient has disabled sending these receipts)
 *
 * There's also a `Failed` state, which represents an error we don't want to recover from.
 *
 * There are some unusual cases where messages don't follow this pattern. For example, if
 * we receive a read receipt before we receive a delivery receipt, we might skip the
 * Delivered state. However, we should never go "backwards".
 *
 * Be careful when changing these values, as they are persisted.
 */
export enum SendStatus {
  Failed = 'Failed',
  Pending = 'Pending',
  Sent = 'Sent',
  Delivered = 'Delivered',
  Read = 'Read',
  Viewed = 'Viewed',
}

export const parseMessageSendStatus = makeEnumParser(
  SendStatus,
  SendStatus.Pending
);

const STATUS_NUMBERS: Record<SendStatus, number> = {
  [SendStatus.Failed]: 0,
  [SendStatus.Pending]: 1,
  [SendStatus.Sent]: 2,
  [SendStatus.Delivered]: 3,
  [SendStatus.Read]: 4,
  [SendStatus.Viewed]: 5,
};

export const maxStatus = (a: SendStatus, b: SendStatus): SendStatus =>
  STATUS_NUMBERS[a] > STATUS_NUMBERS[b] ? a : b;

export const isViewed = (status: SendStatus): boolean =>
  status === SendStatus.Viewed;
export const isRead = (status: SendStatus): boolean =>
  STATUS_NUMBERS[status] >= STATUS_NUMBERS[SendStatus.Read];
export const isDelivered = (status: SendStatus): boolean =>
  STATUS_NUMBERS[status] >= STATUS_NUMBERS[SendStatus.Delivered];
export const isSent = (status: SendStatus): boolean =>
  STATUS_NUMBERS[status] >= STATUS_NUMBERS[SendStatus.Sent];
export const isFailed = (status: SendStatus): boolean =>
  status === SendStatus.Failed;

/**
 * `SendState` combines `SendStatus` and a timestamp. You can use it to show things to the
 * user such as "this message was delivered at 6:09pm".
 *
 * The timestamp may be undefined if reading old data, which did not store a timestamp.
 */
export type SendState = Readonly<{
  // When sending a story to multiple distribution lists at once, we need to
  // de-duplicate the recipients. The story should only be sent once to each
  // recipient in the list so the recipient only sees it rendered once.
  isAlreadyIncludedInAnotherDistributionList?: boolean;
  isAllowedToReplyToStory?: boolean;
  status:
    | SendStatus.Pending
    | SendStatus.Failed
    | SendStatus.Sent
    | SendStatus.Delivered
    | SendStatus.Read
    | SendStatus.Viewed;
  updatedAt?: number;
}>;

/**
 * The reducer advances the little `SendState` state machine. It mostly follows the steps
 * in the `SendStatus` documentation above, but it also handles edge cases.
 */
export function sendStateReducer(
  state: Readonly<SendState>,
  action: Readonly<SendAction>
): SendState {
  const oldStatus = state.status;
  let newStatus: SendStatus;

  if (
    oldStatus === SendStatus.Pending &&
    action.type === SendActionType.Failed
  ) {
    newStatus = SendStatus.Failed;
  } else {
    newStatus = maxStatus(oldStatus, STATE_TRANSITIONS[action.type]);
  }

  return newStatus === oldStatus
    ? state
    : {
        status: newStatus,
        updatedAt: action.updatedAt,
      };
}

export enum SendActionType {
  Failed,
  ManuallyRetried,
  Sent,
  GotDeliveryReceipt,
  GotReadReceipt,
  GotViewedReceipt,
}

export type SendAction = Readonly<{
  type:
    | SendActionType.Failed
    | SendActionType.ManuallyRetried
    | SendActionType.Sent
    | SendActionType.GotDeliveryReceipt
    | SendActionType.GotReadReceipt
    | SendActionType.GotViewedReceipt;
  // `updatedAt?: number` makes it easier to forget the property. With this type, you have
  //   to explicitly say it's missing.
  updatedAt: undefined | number;
}>;

const STATE_TRANSITIONS: Record<SendActionType, SendStatus> = {
  [SendActionType.Failed]: SendStatus.Failed,
  [SendActionType.ManuallyRetried]: SendStatus.Pending,
  [SendActionType.Sent]: SendStatus.Sent,
  [SendActionType.GotDeliveryReceipt]: SendStatus.Delivered,
  [SendActionType.GotReadReceipt]: SendStatus.Read,
  [SendActionType.GotViewedReceipt]: SendStatus.Viewed,
};

export type SendStateByConversationId = Record<string, SendState>;

export const someSendStatus = (
  sendStateByConversationId: undefined | Readonly<SendStateByConversationId>,
  predicate: (value: SendStatus) => boolean
): boolean =>
  Object.values(sendStateByConversationId || {}).some(sendState =>
    predicate(sendState.status)
  );

export const isMessageJustForMe = (
  sendStateByConversationId: undefined | Readonly<SendStateByConversationId>,
  ourConversationId: string | undefined
): boolean => {
  const conversationIds = Object.keys(sendStateByConversationId || {});
  return Boolean(
    ourConversationId &&
      conversationIds.length === 1 &&
      conversationIds[0] === ourConversationId
  );
};
