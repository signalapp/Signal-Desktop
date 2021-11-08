// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';

import { MainHeader } from '../../components/MainHeader';
import type { StateType } from '../reducer';

import { getPreferredBadgeSelector } from '../selectors/badges';
import {
  getQuery,
  getSearchConversation,
  getStartSearchCounter,
} from '../selectors/search';
import {
  getIntl,
  getRegionCode,
  getTheme,
  getUserConversationId,
  getUserNumber,
  getUserUuid,
} from '../selectors/user';
import { getMe, getSelectedConversation } from '../selectors/conversations';

const mapStateToProps = (state: StateType) => {
  const me = getMe(state);

  return {
    disabled: state.network.challengeStatus !== 'idle',
    hasPendingUpdate: Boolean(state.updates.didSnooze),
    searchTerm: getQuery(state),
    searchConversation: getSearchConversation(state),
    selectedConversation: getSelectedConversation(state),
    startSearchCounter: getStartSearchCounter(state),
    regionCode: getRegionCode(state),
    ourConversationId: getUserConversationId(state),
    ourNumber: getUserNumber(state),
    ourUuid: getUserUuid(state),
    ...me,
    badge: getPreferredBadgeSelector(state)(me.badges),
    theme: getTheme(state),
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartMainHeader = smart(MainHeader);
