// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';

import { App, PropsType } from '../../components/App';
import { SmartCallManager } from './CallManager';
import { SmartGlobalModalContainer } from './GlobalModalContainer';
import { StateType } from '../reducer';
import { getTheme } from '../selectors/user';
import { mapDispatchToProps } from '../actions';

const mapStateToProps = (state: StateType): PropsType => {
  return {
    ...state.app,
    renderCallManager: () => <SmartCallManager />,
    renderGlobalModalContainer: () => <SmartGlobalModalContainer />,
    theme: getTheme(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartApp = smart(App);
