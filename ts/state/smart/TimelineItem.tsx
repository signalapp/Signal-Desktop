// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { RefObject } from 'react';
import React from 'react';
import { connect } from 'react-redux';

import { mapDispatchToProps } from '../actions';
import type { StateType } from '../reducer';

import { TimelineItem } from '../../components/conversation/TimelineItem';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { getIntl, getInteractionMode, getTheme } from '../selectors/user';
import {
  getConversationSelector,
  getMessageSelector,
  getSelectedMessage,
} from '../selectors/conversations';
import {
  areMessagesInSameGroup,
  shouldCurrentMessageHideMetadata,
  UnreadIndicatorPlacement,
} from '../../util/timelineUtil';

import { SmartContactName } from './ContactName';
import { SmartUniversalTimerNotification } from './UniversalTimerNotification';
import { isSameDay } from '../../util/timestamp';

type ExternalProps = {
  containerElementRef: RefObject<HTMLElement>;
  conversationId: string;
  isOldestTimelineItem: boolean;
  messageId: string;
  nextMessageId: undefined | string;
  previousMessageId: undefined | string;
  unreadIndicatorPlacement: undefined | UnreadIndicatorPlacement;
};

function renderContact(conversationId: string): JSX.Element {
  return <SmartContactName conversationId={conversationId} />;
}

function renderUniversalTimerNotification(): JSX.Element {
  return <SmartUniversalTimerNotification />;
}

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  const {
    containerElementRef,
    conversationId,
    isOldestTimelineItem,
    messageId,
    nextMessageId,
    previousMessageId,
    unreadIndicatorPlacement,
  } = props;

  const messageSelector = getMessageSelector(state);

  const item = messageSelector(messageId);
  const previousItem = previousMessageId
    ? messageSelector(previousMessageId)
    : undefined;
  const nextItem = nextMessageId ? messageSelector(nextMessageId) : undefined;

  const selectedMessage = getSelectedMessage(state);
  const isSelected = Boolean(
    selectedMessage && messageId === selectedMessage.id
  );

  const conversation = getConversationSelector(state)(conversationId);

  const isNextItemCallingNotification = nextItem?.type === 'callHistory';

  const shouldCollapseAbove = areMessagesInSameGroup(
    previousItem,
    unreadIndicatorPlacement === UnreadIndicatorPlacement.JustAbove,
    item
  );
  const shouldCollapseBelow = areMessagesInSameGroup(
    item,
    unreadIndicatorPlacement === UnreadIndicatorPlacement.JustBelow,
    nextItem
  );
  const shouldHideMetadata = shouldCurrentMessageHideMetadata(
    shouldCollapseBelow,
    item,
    nextItem
  );
  const shouldRenderDateHeader =
    isOldestTimelineItem ||
    Boolean(
      item &&
        previousItem &&
        // This comparison avoids strange header behavior for out-of-order messages.
        item.timestamp > previousItem.timestamp &&
        !isSameDay(previousItem.timestamp, item.timestamp)
    );

  return {
    item,
    id: messageId,
    containerElementRef,
    conversationId,
    conversationColor: conversation.conversationColor,
    customColor: conversation.customColor,
    getPreferredBadge: getPreferredBadgeSelector(state),
    isNextItemCallingNotification,
    isSelected,
    renderContact,
    renderUniversalTimerNotification,
    shouldCollapseAbove,
    shouldCollapseBelow,
    shouldHideMetadata,
    shouldRenderDateHeader,
    i18n: getIntl(state),
    interactionMode: getInteractionMode(state),
    theme: getTheme(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartTimelineItem = smart(TimelineItem);
