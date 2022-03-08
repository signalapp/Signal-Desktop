// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { TimelineItemType } from '../components/conversation/TimelineItem';
import { WidthBreakpoint } from '../components/_util';
import { MINUTE } from './durations';
import { isSameDay } from './timestamp';

const COLLAPSE_WITHIN = 3 * MINUTE;

export enum UnreadIndicatorPlacement {
  JustAbove,
  JustBelow,
}

type MessageTimelineItemDataType = Readonly<{
  author: { id: string };
  reactions?: ReadonlyArray<unknown>;
  timestamp: number;
}>;

// This lets us avoid passing a full `MessageType`. That's useful for tests and for
//   documentation.
type MaybeMessageTimelineItemType = Readonly<
  | undefined
  | TimelineItemType
  | { type: 'message'; data: MessageTimelineItemDataType }
>;

const getMessageTimelineItemData = (
  timelineItem: MaybeMessageTimelineItemType
): undefined | MessageTimelineItemDataType =>
  timelineItem?.type === 'message' ? timelineItem.data : undefined;

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
      newerMessage.timestamp >= olderMessage.timestamp &&
      newerMessage.timestamp - olderMessage.timestamp < COLLAPSE_WITHIN &&
      isSameDay(olderMessage.timestamp, newerMessage.timestamp)
  );
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
