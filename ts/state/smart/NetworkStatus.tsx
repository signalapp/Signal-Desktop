// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { DialogNetworkStatus } from '../../components/DialogNetworkStatus';
import type { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import type { WidthBreakpoint } from '../../components/_util';

type PropsType = Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>;

const mapStateToProps = (state: StateType, ownProps: PropsType) => {
  return {
    ...state.network,
    i18n: getIntl(state),
    ...ownProps,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartNetworkStatus = smart(DialogNetworkStatus);
