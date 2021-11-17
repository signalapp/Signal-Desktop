// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CSSProperties } from 'react';
import { connect } from 'react-redux';

import { mapDispatchToProps } from '../actions';
import type { StateType } from '../reducer';

import { MessageSearchResult } from '../../components/conversationList/MessageSearchResult';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { getIntl, getTheme } from '../selectors/user';
import { getMessageSearchResultSelector } from '../selectors/search';

type SmartProps = {
  id: string;
  style?: CSSProperties;
};

function mapStateToProps(state: StateType, ourProps: SmartProps) {
  const { id, style } = ourProps;

  const props = getMessageSearchResultSelector(state)(id);
  if (!props) {
    throw new Error('SmartMessageSearchResult: no message was found');
  }

  return {
    ...props,
    getPreferredBadge: getPreferredBadgeSelector(state),
    i18n: getIntl(state),
    style,
    theme: getTheme(state),
  };
}
const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartMessageSearchResult = smart(MessageSearchResult);
