// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import { createLogger } from '../logging/log.std.js';
// eslint-disable-next-line import/no-restricted-paths
import type { PropsType as TimelinePropsType } from '../components/conversation/Timeline.dom.js';
// eslint-disable-next-line import/no-restricted-paths
import type { TimelineItemType } from '../components/conversation/TimelineItem.dom.js';
// eslint-disable-next-line import/no-restricted-paths
import { WidthBreakpoint } from '../components/_util.std.js';
import { toLogFormat } from '../types/errors.std.js';
import { MINUTE } from './durations/index.std.js';
import { missingCaseError } from './missingCaseError.std.js';
import { isSameDay } from './timestamp.std.js';
import type { LastMessageStatus } from '../model-types.d.ts';

const { isNumber } = lodash;

const log = createLogger('timelineUtil');

const COLLAPSE_WITHIN = 3 * MINUTE;

export enum TimelineMessageLoadingState {
  // We start the enum at 1 because the default starting value of 0 is falsy.
  DoingInitialLoad = 1,
  LoadingOlderMessages,
  LoadingNewerMessages,
}

export enum ScrollAnchor {
  ChangeNothing,
  ScrollToBottom,
  ScrollToIndex,
  ScrollToUnreadIndicator,
  Top,
  Bottom,
}

export enum UnreadIndicatorPlacement {
  JustAbove,
  JustBelow,
}

export type MessageTimelineItemDataType = Readonly<{
  author: { id: string };
  deletedForEveryone?: boolean;
  isEditedMessage?: boolean;
  reactions?: ReadonlyArray<unknown>;
  status?: LastMessageStatus;
  timestamp: number;
}>;

// This lets us avoid passing a full `MessageType`. That's useful for tests and for
//   documentation.
export type MaybeMessageTimelineItemType = Readonly<
  | undefined
  | TimelineItemType
  | { type: 'message'; data: MessageTimelineItemDataType }
>;

const getMessageTimelineItemData = (
  timelineItem: MaybeMessageTimelineItemType
): undefined | MessageTimelineItemDataType =>
  timelineItem?.type === 'message' ? timelineItem.data : undefined;

export function shouldCurrentMessageHideMetadata(
  areMessagesGrouped: boolean,
  item: MaybeMessageTimelineItemType,
  newerTimelineItem: MaybeMessageTimelineItemType
): boolean {
  if (!areMessagesGrouped) {
    return false;
  }

  const message = getMessageTimelineItemData(item);
  if (!message) {
    return false;
  }

  if (message.isEditedMessage) {
    return false;
  }

  const newerMessage = getMessageTimelineItemData(newerTimelineItem);
  if (!newerMessage) {
    return false;
  }

  // If newer message is deleted, but current isn't, we'll show metadata.
  if (newerMessage.deletedForEveryone && !message.deletedForEveryone) {
    return false;
  }

  switch (message.status) {
    case undefined:
      return true;
    case 'paused':
    case 'error':
    case 'partial-sent':
    case 'sending':
      return false;
    case 'sent':
    case 'delivered':
    case 'read':
    case 'viewed':
      return true;
    default:
      log.error(toLogFormat(missingCaseError(message.status)));
      return true;
  }
}

export function areMessagesInSameGroup(
  olderTimelineItem: MaybeMessageTimelineItemType,
  unreadIndicator: boolean,
  newerTimelineItem: MaybeMessageTimelineItemType
): boolean {
  if (unreadIndicator) {
    return false;
  }

  const olderMessage = getMessageTimelineItemData(olderTimelineItem);
  if (!olderMessage) {
    return false;
  }

  const newerMessage = getMessageTimelineItemData(newerTimelineItem);
  if (!newerMessage) {
    return false;
  }

  return Boolean(
    !olderMessage.reactions?.length &&
      olderMessage.author.id === newerMessage.author.id &&
      (olderMessage.isEditedMessage ||
        newerMessage.timestamp >= olderMessage.timestamp) &&
      newerMessage.timestamp - olderMessage.timestamp < COLLAPSE_WITHIN &&
      isSameDay(olderMessage.timestamp, newerMessage.timestamp)
  );
}

type ScrollAnchorBeforeUpdateProps = Readonly<
  Pick<
    TimelinePropsType,
    | 'haveNewest'
    | 'isIncomingMessageRequest'
    | 'isSomeoneTyping'
    | 'items'
    | 'messageLoadingState'
    | 'oldestUnseenIndex'
    | 'scrollToIndex'
    | 'scrollToIndexCounter'
  >
>;

export function getScrollAnchorBeforeUpdate(
  prevProps: ScrollAnchorBeforeUpdateProps,
  props: ScrollAnchorBeforeUpdateProps,
  isAtBottom: boolean
): ScrollAnchor {
  if (props.messageLoadingState || !props.items.length) {
    return ScrollAnchor.ChangeNothing;
  }

  const loadingStateThatJustFinished: undefined | TimelineMessageLoadingState =
    !props.messageLoadingState && prevProps.messageLoadingState
      ? prevProps.messageLoadingState
      : undefined;

  if (
    isNumber(props.scrollToIndex) &&
    (loadingStateThatJustFinished ===
      TimelineMessageLoadingState.DoingInitialLoad ||
      prevProps.scrollToIndex !== props.scrollToIndex ||
      prevProps.scrollToIndexCounter !== props.scrollToIndexCounter)
  ) {
    return ScrollAnchor.ScrollToIndex;
  }

  switch (loadingStateThatJustFinished) {
    case TimelineMessageLoadingState.DoingInitialLoad:
      if (props.isIncomingMessageRequest) {
        return ScrollAnchor.ChangeNothing;
      }
      if (isNumber(props.oldestUnseenIndex)) {
        return ScrollAnchor.ScrollToUnreadIndicator;
      }
      return ScrollAnchor.ScrollToBottom;
    case TimelineMessageLoadingState.LoadingOlderMessages:
      return ScrollAnchor.Bottom;
    case TimelineMessageLoadingState.LoadingNewerMessages:
      return ScrollAnchor.Top;
    case undefined: {
      const didSomethingChange =
        prevProps.items.length !== props.items.length ||
        (props.haveNewest &&
          prevProps.isSomeoneTyping !== props.isSomeoneTyping);
      if (didSomethingChange && isAtBottom) {
        return ScrollAnchor.ScrollToBottom;
      }
      break;
    }
    default:
      throw missingCaseError(loadingStateThatJustFinished);
  }

  return ScrollAnchor.ChangeNothing;
}

export function getWidthBreakpoint(width: number): WidthBreakpoint {
  if (width > 606) {
    return WidthBreakpoint.Wide;
  }
  if (width > 514) {
    return WidthBreakpoint.Medium;
  }
  return WidthBreakpoint.Narrow;
}
