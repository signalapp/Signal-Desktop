// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';

import { MainHeader } from '../../components/MainHeader';
import type { StateType } from '../reducer';

import {
  getQuery,
  getSearchConversation,
  getStartSearchCounter,
} from '../selectors/search';
import {
  getIntl,
  getRegionCode,
  getUserConversationId,
  getUserNumber,
  getUserUuid,
} from '../selectors/user';
import { getMe, getSelectedConversation } from '../selectors/conversations';

const mapStateToProps = (state: StateType) => {
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
    ...getMe(state),
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartMainHeader = smart(MainHeader);
