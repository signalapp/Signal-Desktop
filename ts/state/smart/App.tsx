// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';

import { App } from '../../components/App';
import { SmartCallManager } from './CallManager';
import { SmartGlobalModalContainer } from './GlobalModalContainer';
import { SmartSafetyNumberViewer } from './SafetyNumberViewer';
import { StateType } from '../reducer';
import { getIntl, getTheme } from '../selectors/user';
import {
  getConversationsStoppingMessageSendBecauseOfVerification,
  getNumberOfMessagesPendingBecauseOfVerification,
} from '../selectors/conversations';
import { mapDispatchToProps } from '../actions';
import type { SafetyNumberProps } from '../../components/SafetyNumberChangeDialog';

const mapStateToProps = (state: StateType) => {
  return {
    ...state.app,
    conversationsStoppingMessageSendBecauseOfVerification: getConversationsStoppingMessageSendBecauseOfVerification(
      state
    ),
    i18n: getIntl(state),
    numberOfMessagesPendingBecauseOfVerification: getNumberOfMessagesPendingBecauseOfVerification(
      state
    ),
    renderCallManager: () => <SmartCallManager />,
    renderGlobalModalContainer: () => <SmartGlobalModalContainer />,
    renderSafetyNumber: (props: SafetyNumberProps) => (
      <SmartSafetyNumberViewer {...props} />
    ),
    theme: getTheme(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartApp = smart(App);
