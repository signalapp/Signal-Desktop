// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import memoizee from 'memoizee';
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
  Skipped = 'Skipped',
}

export const parseMessageSendStatus = makeEnumParser(
  SendStatus,
  SendStatus.Pending
);

export const UNDELIVERED_SEND_STATUSES = [
  SendStatus.Pending,
  SendStatus.Failed,
];

export type VisibleSendStatus =
  | SendStatus.Failed
  | SendStatus.Pending
  | SendStatus.Sent
  | SendStatus.Delivered
  | SendStatus.Read
  | SendStatus.Viewed;

const STATUS_NUMBERS: Record<SendStatus, number> = {
  [SendStatus.Failed]: 0,
  [SendStatus.Pending]: 1,
  [SendStatus.Sent]: 2,
  [SendStatus.Delivered]: 3,
  [SendStatus.Read]: 4,
  [SendStatus.Viewed]: 5,
  [SendStatus.Skipped]: 6,
};

export const maxStatus = (a: SendStatus, b: SendStatus): SendStatus =>
  STATUS_NUMBERS[a] > STATUS_NUMBERS[b] ? a : b;

export const isPending = (status: SendStatus): boolean =>
  status === SendStatus.Pending;
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
export const isSkipped = (status: SendStatus): boolean =>
  status === SendStatus.Skipped;

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
    | SendStatus.Viewed
    | SendStatus.Skipped;
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
        ...state,
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

/** Test all of sendStateByConversationId for predicate  */
export const someSendStatus = (
  sendStateByConversationId: SendStateByConversationId,
  predicate: (value: SendStatus) => boolean
): boolean => {
  return [
    ...summarizeMessageSendStatuses(sendStateByConversationId).statuses,
  ].some(predicate);
};

/** Test sendStateByConversationId, excluding ourConversationId, for predicate  */
export const someRecipientSendStatus = (
  sendStateByConversationId: SendStateByConversationId,
  ourConversationId: string | undefined,
  predicate: (value: SendStatus) => boolean
): boolean => {
  return getStatusesIgnoringOurConversationId(
    sendStateByConversationId,
    ourConversationId
  ).some(predicate);
};

export const isMessageJustForMe = (
  sendStateByConversationId: SendStateByConversationId,
  ourConversationId: string | undefined
): boolean => {
  const { length } = summarizeMessageSendStatuses(sendStateByConversationId);

  return (
    ourConversationId !== undefined &&
    length === 1 &&
    Object.hasOwn(sendStateByConversationId, ourConversationId)
  );
};

export const getHighestSuccessfulRecipientStatus = (
  sendStateByConversationId: SendStateByConversationId,
  ourConversationId: string | undefined
): SendStatus => {
  return getStatusesIgnoringOurConversationId(
    sendStateByConversationId,
    ourConversationId
  ).reduce(
    (result: SendStatus, status) => maxStatus(result, status),
    SendStatus.Pending
  );
};

const getStatusesIgnoringOurConversationId = (
  sendStateByConversationId: SendStateByConversationId,
  ourConversationId: string | undefined
): Array<SendStatus> => {
  const { statuses, statusesWithOnlyOneConversationId } =
    summarizeMessageSendStatuses(sendStateByConversationId);

  const statusesIgnoringOurConversationId = [];

  for (const status of statuses) {
    if (
      ourConversationId &&
      statusesWithOnlyOneConversationId.get(status) === ourConversationId
    ) {
      // ignore this status; it only applies to us
    } else {
      statusesIgnoringOurConversationId.push(status);
    }
  }

  return statusesIgnoringOurConversationId;
};

// Looping through each value in sendStateByConversationId can be quite slow, especially
// if sendStateByConversationId is large (e.g. in a large group) and if it is actually a
// proxy (e.g. being called via useProxySelector) -- that's why we memoize it here.
const summarizeMessageSendStatuses = memoizee(
  (
    sendStateByConversationId: SendStateByConversationId
  ): {
    statuses: Set<SendStatus>;
    statusesWithOnlyOneConversationId: Map<SendStatus, string>;
    length: number;
  } => {
    const statuses: Set<SendStatus> = new Set();

    // We keep track of statuses with only one conversationId associated with it
    // so that we can ignore a status if it is only for ourConversationId, as needed
    const statusesWithOnlyOneConversationId: Map<SendStatus, string> =
      new Map();

    const entries = Object.entries(sendStateByConversationId);

    for (const [conversationId, { status }] of entries) {
      if (!statuses.has(status)) {
        statuses.add(status);
        statusesWithOnlyOneConversationId.set(status, conversationId);
      } else {
        statusesWithOnlyOneConversationId.delete(status);
      }
    }

    return {
      statuses,
      statusesWithOnlyOneConversationId,
      length: entries.length,
    };
  },
  { max: 100 }
);
