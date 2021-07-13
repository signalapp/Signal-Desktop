// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';

import { mapDispatchToProps } from '../actions';
import { StateType } from '../reducer';

import { TimelineItem } from '../../components/conversation/TimelineItem';
import { getIntl, getInteractionMode, getTheme } from '../selectors/user';
import {
  getContactNameColorSelector,
  getConversationSelector,
  getMessageSelector,
  getSelectedMessage,
} from '../selectors/conversations';

import { SmartContactName } from './ContactName';
import { SmartUniversalTimerNotification } from './UniversalTimerNotification';

type ExternalProps = {
  id: string;
  conversationId: string;
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
  const { id, conversationId } = props;

  const messageSelector = getMessageSelector(state);
  const item = messageSelector(id);

  if (item?.type === 'message' && item.data.conversationType === 'group') {
    const { author } = item.data;
    item.data.contactNameColor = getContactNameColorSelector(state)(
      conversationId,
      author.id
    );
  }

  const selectedMessage = getSelectedMessage(state);
  const isSelected = Boolean(selectedMessage && id === selectedMessage.id);

  const conversation = getConversationSelector(state)(conversationId);

  return {
    item,
    id,
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
