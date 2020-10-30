// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { CallManager } from '../../components/CallManager';
import { StateType } from '../reducer';

import { getIntl } from '../selectors/user';

import { SmartCallingDeviceSelection } from './CallingDeviceSelection';

function renderDeviceSelection(): JSX.Element {
  return <SmartCallingDeviceSelection />;
}

const mapStateToProps = (state: StateType) => {
  const { calling } = state;
  return {
    ...calling,
    i18n: getIntl(state),
    renderDeviceSelection,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartCallManager = smart(CallManager);
