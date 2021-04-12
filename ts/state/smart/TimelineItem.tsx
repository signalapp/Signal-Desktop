// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';

import { mapDispatchToProps } from '../actions';
import { StateType } from '../reducer';

import { TimelineItem } from '../../components/conversation/TimelineItem';
import { getIntl, getInteractionMode, getTheme } from '../selectors/user';
import {
  getMessageSelector,
  getSelectedMessage,
} from '../selectors/conversations';

import { SmartContactName } from './ContactName';

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

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  const { id, conversationId } = props;

  const messageSelector = getMessageSelector(state);
  const item = messageSelector(id);

  const selectedMessage = getSelectedMessage(state);
  const isSelected = Boolean(selectedMessage && id === selectedMessage.id);

  return {
    item,
    id,
    conversationId,
    isSelected,
    renderContact,
    i18n: getIntl(state),
    interactionMode: getInteractionMode(state),
    theme: getTheme(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartTimelineItem = smart(TimelineItem);
