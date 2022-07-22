// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';

import { MainHeader } from '../../components/MainHeader';
import type { StateType } from '../reducer';

import { getPreferredBadgeSelector } from '../selectors/badges';
import {
  getIntl,
  getRegionCode,
  getTheme,
  getUserConversationId,
  getUserNumber,
} from '../selectors/user';
import { getMe } from '../selectors/conversations';
import { getStoriesEnabled } from '../selectors/items';
import { getUnreadStorySenderCount } from '../selectors/stories';

const mapStateToProps = (state: StateType) => {
  const me = getMe(state);

  return {
    areStoriesEnabled: getStoriesEnabled(state),
    hasPendingUpdate: Boolean(state.updates.didSnooze),
    regionCode: getRegionCode(state),
    ourConversationId: getUserConversationId(state),
    ourNumber: getUserNumber(state),
    ...me,
    badge: getPreferredBadgeSelector(state)(me.badges),
    theme: getTheme(state),
    i18n: getIntl(state),
    unreadStoriesCount: getUnreadStorySenderCount(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartMainHeader = smart(MainHeader);
