// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { UniversalTimerNotification } from '../../components/conversation/UniversalTimerNotification';
import type { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { getUniversalExpireTimer } from '../selectors/items';

const mapStateToProps = (state: StateType) => {
  return {
    ...state.updates,
    i18n: getIntl(state),
    expireTimer: getUniversalExpireTimer(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartUniversalTimerNotification = smart(
  UniversalTimerNotification
);
