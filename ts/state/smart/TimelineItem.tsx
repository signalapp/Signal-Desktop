// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { RefObject } from 'react';
import { connect } from 'react-redux';

import { mapDispatchToProps } from '../actions';
import { StateType } from '../reducer';

import { TimelineItem } from '../../components/conversation/TimelineItem';
import { getIntl, getInteractionMode, getTheme } from '../selectors/user';
import {
  getConversationSelector,
  getMessageSelector,
  getSelectedMessage,
} from '../selectors/conversations';

import { SmartContactName } from './ContactName';
import { SmartUniversalTimerNotification } from './UniversalTimerNotification';

type ExternalProps = {
  containerElementRef: RefObject<HTMLElement>;
  conversationId: string;
  messageId: string;
  nextMessageId: undefined | string;
  previousMessageId: undefined | string;
};

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
/* eslint-disable @typescript-eslint/no-explicit-any */
const FilteredSmartContactName = SmartContactName as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

function renderContact(conversationId: string): JSX.Element {
  return <FilteredSmartContactName conversationId={conversationId} />;
}

function renderUniversalTimerNotification(): JSX.Element {
  return <SmartUniversalTimerNotification />;
}

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  const {
    containerElementRef,
    conversationId,
    messageId,
    nextMessageId,
    previousMessageId,
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

  return {
    item,
    previousItem,
    nextItem,
    id: messageId,
    containerElementRef,
    conversationId,
    conversationColor: conversation?.conversationColor,
    customColor: conversation?.customColor,
    isSelected,
    renderContact,
    renderUniversalTimerNotification,
    i18n: getIntl(state),
    interactionMode: getInteractionMode(state),
    theme: getTheme(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartTimelineItem = smart(TimelineItem);
