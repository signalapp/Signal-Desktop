// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber } from 'lodash';
import type { PropsType as TimelinePropsType } from '../components/conversation/Timeline';
import type { TimelineItemType } from '../components/conversation/TimelineItem';
import { WidthBreakpoint } from '../components/_util';
import { MINUTE } from './durations';
import { missingCaseError } from './missingCaseError';
import { isSameDay } from './timestamp';
import type { LastMessageStatus } from '../model-types.d';

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

function isDelivered(status?: LastMessageStatus) {
  return status === 'delivered' || status === 'read' || status === 'viewed';
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

  // We definitely don't want to group if we transition from non-deleted to deleted, since
  //   deleted messages don't show status.
  if (newerMessage.deletedForEveryone && !olderMessage.deletedForEveryone) {
    return false;
  }

  return Boolean(
    !olderMessage.reactions?.length &&
      olderMessage.author.id === newerMessage.author.id &&
      newerMessage.timestamp >= olderMessage.timestamp &&
      newerMessage.timestamp - olderMessage.timestamp < COLLAPSE_WITHIN &&
      isSameDay(olderMessage.timestamp, newerMessage.timestamp) &&
      (olderMessage.status === newerMessage.status ||
        (isDelivered(newerMessage.status) && isDelivered(olderMessage.status)))
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
    | 'oldestUnreadIndex'
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
      if (isNumber(props.oldestUnreadIndex)) {
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
