// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';

import { App } from '../../components/App';
import { StateType } from '../reducer';
import { getIntl, getTheme } from '../selectors/user';
import { mapDispatchToProps } from '../actions';

const mapStateToProps = (state: StateType) => {
  return {
    ...state.app,
    i18n: getIntl(state),
    theme: getTheme(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartApp = smart(App);
